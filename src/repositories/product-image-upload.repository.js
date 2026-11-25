export const createUpload = async (
  connection,
  {
    id,
    staffUserId,
    productId,
    productVariantId,
    stagingKey,
    finalKey,
    contentType,
    altText,
    sortOrder,
    isPrimary,
    expiresInSeconds,
  },
) => {
  await connection.execute(
    `
      INSERT INTO product_image_uploads (
        id,
        staff_user_id,
        product_id,
        product_variant_id,
        staging_key,
        final_key,
        content_type,
        alt_text,
        sort_order,
        is_primary,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))
    `,
    [
      id,
      staffUserId,
      productId,
      productVariantId,
      stagingKey,
      finalKey,
      contentType,
      altText,
      sortOrder,
      isPrimary ? 1 : 0,
      expiresInSeconds,
    ],
  );
};

export const findUploadForUpdate = async (
  connection,
  { id, staffUserId, productId },
) => {
  const [rows] = await connection.execute(
    `
      SELECT
        *,
        expires_at > UTC_TIMESTAMP() AS is_unexpired
      FROM product_image_uploads
      WHERE id = ?
        AND staff_user_id = ?
        AND product_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [id, staffUserId, productId],
  );

  return rows[0] || null;
};

export const markUploadCompleted = async (
  connection,
  { id, staffUserId, productId, stagingVersionId, productImageId },
) => {
  const [result] = await connection.execute(
    `
      UPDATE product_image_uploads
      SET
        status = 'completed',
        staging_version_id = ?,
        product_image_id = ?
      WHERE id = ?
        AND staff_user_id = ?
        AND product_id = ?
        AND status = 'pending'
    `,
    [stagingVersionId, productImageId, id, staffUserId, productId],
  );

  return result.affectedRows;
};

export const findProductForUpdate = async (connection, productId) => {
  const [rows] = await connection.execute(
    `
      SELECT id
      FROM products
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [productId],
  );

  return rows[0] || null;
};

export const findVariantForUpdate = async (
  connection,
  { productId, variantId },
) => {
  const [rows] = await connection.execute(
    `
      SELECT id, product_id
      FROM product_variants
      WHERE id = ?
        AND product_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [variantId, productId],
  );

  return rows[0] || null;
};

export const insertVerifiedImage = async (
  connection,
  { productId, productVariantId, finalKey, altText, sortOrder, isPrimary },
) => {
  const [countRows] = await connection.execute(
    "SELECT COUNT(*) AS total FROM product_images WHERE product_id = ?",
    [productId],
  );

  const shouldBePrimary = countRows[0].total === 0 || isPrimary;

  if (shouldBePrimary) {
    await connection.execute(
      "UPDATE product_images SET is_primary = 0 WHERE product_id = ?",
      [productId],
    );
  }

  // New S3 images have no local file path.
  const imagePath = `s3:${finalKey}`;

  const [result] = await connection.execute(
    `
      INSERT INTO product_images (
        product_id,
        product_variant_id,
        image_path,
        media_driver,
        storage_key,
        alt_text,
        sort_order,
        is_primary
      )
      VALUES (?, ?, ?, 's3', ?, ?, ?, ?)
    `,
    [
      productId,
      productVariantId,
      imagePath,
      finalKey,
      altText,
      sortOrder,
      shouldBePrimary ? 1 : 0,
    ],
  );

  return result.insertId;
};

export const findCompletedImageForUpdate = async (
  connection,
  { productId, imageId, finalKey },
) => {
  const [rows] = await connection.execute(
    `
      SELECT id, product_id
      FROM product_images
      WHERE id = ?
        AND product_id = ?
        AND media_driver = 's3'
        AND storage_key = ?
      LIMIT 1
      FOR UPDATE
    `,
    [imageId, productId, finalKey],
  );

  return rows[0] || null;
};
