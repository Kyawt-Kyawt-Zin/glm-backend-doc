import pool from "../helper/db_helper.js";

export const findAllByProductId = async (productId) => {
  const [images] = await pool.execute(
    `SELECT
      id,
      product_id,
      image_path,
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
      image_path,
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
  imagePath,
  altText,
  sortOrder,
  isPrimary,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO product_images (
      product_id,
      image_path,
      alt_text,
      sort_order,
      is_primary
    )
    VALUES (?, ?, ?, ?, ?)`,
    [productId, imagePath, altText || null, sortOrder || 0, isPrimary ? 1 : 0],
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

export const updateImageDetails = async (id, { altText, sortOrder }) => {
  await pool.execute(
    `UPDATE product_images
     SET
       alt_text = ?,
       sort_order = ?
     WHERE id = ?`,
    [altText || null, sortOrder, id],
  );
};
