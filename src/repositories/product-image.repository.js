import pool from "../helper/db_helper.js";

export const removeS3ImageFromProduct = async (productId, imageId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [products] = await connection.execute("SELECT id FROM products WHERE id = ? FOR UPDATE", [productId]);
    if (!products.length) { await connection.rollback(); return false; }
    const [images] = await connection.execute(
      "SELECT id, is_primary FROM product_images WHERE id = ? AND product_id = ? AND media_driver = 's3' FOR UPDATE",
      [imageId, productId],
    );
    if (!images.length) { await connection.rollback(); return false; }
    await connection.execute("DELETE FROM product_images WHERE id = ? AND product_id = ?", [imageId, productId]);
    if (images[0].is_primary) {
      const [remaining] = await connection.execute(
        "SELECT id FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC, id ASC LIMIT 1 FOR UPDATE",
        [productId],
      );
      if (remaining.length) {
        await connection.execute("UPDATE product_images SET is_primary = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE product_id = ?", [remaining[0].id, productId]);
      }
    }
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const findAllByProductId = async (productId) => {
  const [images] = await pool.execute(
    `SELECT
      id,
      product_id,
      product_variant_id,
      image_path,
      media_driver,
      storage_key,
      alt_text,
      sort_order,
      is_primary,
      created_at
    FROM product_images
    WHERE product_id = ?
    ORDER BY is_primary DESC, sort_order ASC, id ASC`,
    [productId],
  );

  return images;
};

export const findById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT
      id,
      product_id,
      product_variant_id,
      image_path,
      media_driver,
      storage_key,
      alt_text,
      sort_order,
      is_primary,
      created_at
    FROM product_images
    WHERE id = ?
    LIMIT 1`,
    [id],
  );

  return rows[0];
};

export const clearPrimaryImage = async (productId) => {
  await pool.execute(
    `UPDATE product_images
     SET is_primary = 0
     WHERE product_id = ?`,
    [productId],
  );
};

export const createImage = async ({
  productId,
  productVariantId,
  imagePath,
  mediaDriver = "local",
  storageKey = null,
  altText,
  sortOrder,
  isPrimary,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO product_images (
      product_id,
      product_variant_id,
      image_path,
      media_driver,
      storage_key,
      alt_text,
      sort_order,
      is_primary
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      productVariantId,
      imagePath,
      mediaDriver,
      storageKey,
      altText || null,
      sortOrder || 0,
      isPrimary ? 1 : 0,
    ],
  );

  return result.insertId;
};

export const deleteById = async (id) => {
  const [result] = await pool.execute(
    "DELETE FROM product_images WHERE id = ?",
    [id],
  );

  return result.affectedRows > 0;
};

export const setPrimaryById = async (id) => {
  await pool.execute(
    `UPDATE product_images
     SET is_primary = 1
     WHERE id = ?`,
    [id],
  );
};

export const updateImageDetails = async (
  id,
  { productVariantId, altText, sortOrder },
) => {
  await pool.execute(
    `UPDATE product_images
     SET
       product_variant_id = ?,
       alt_text = ?,
       sort_order = ?
     WHERE id = ?`,
    [productVariantId, altText || null, sortOrder, id],
  );
};
