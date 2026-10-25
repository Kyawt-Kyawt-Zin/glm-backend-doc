import pool from "../helper/db_helper.js";

export const findActiveCartByUserId = async (userId) => {
  const [carts] = await pool.execute(
    `SELECT
      id,
      user_id,
      status,
      created_at,
      updated_at
    FROM carts
    WHERE user_id = ?
      AND status = 'active'
    ORDER BY id DESC
    LIMIT 1`,
    [userId],
  );

  return carts[0] || null;
};

export const createCart = async (userId) => {
  const [result] = await pool.execute(
    `INSERT INTO carts (user_id)
    VALUES (?)`,
    [userId],
  );

  return {
    id: result.insertId,
    user_id: userId,
    status: "active",
  };
};

export const findCartItemByCartAndVariant = async (
  cartId,
  productVariantId,
) => {
  const [items] = await pool.execute(
    `SELECT
      id,
      cart_id,
      product_variant_id,
      quantity
    FROM cart_items
    WHERE cart_id = ?
      AND product_variant_id = ?
    LIMIT 1`,
    [cartId, productVariantId],
  );

  return items[0] || null;
};

export const createCartItem = async (cartId, productVariantId, quantity) => {
  const [result] = await pool.execute(
    `INSERT INTO cart_items (
      cart_id,
      product_variant_id,
      quantity
    )
    VALUES (?, ?, ?)`,
    [cartId, productVariantId, quantity],
  );

  return {
    id: result.insertId,
    cart_id: cartId,
    product_variant_id: productVariantId,
    quantity,
  };
};

export const updateCartItemQuantity = async (itemId, quantity) => {
  await pool.execute(
    `UPDATE cart_items
    SET quantity = ?
    WHERE id = ?`,
    [quantity, itemId],
  );
};

export const findActiveCartItemByIdAndUserId = async (itemId, userId) => {
  const [items] = await pool.execute(
    `SELECT
      cart_items.id,
      cart_items.cart_id,
      cart_items.product_variant_id,
      cart_items.quantity
    FROM cart_items
    INNER JOIN carts
      ON carts.id = cart_items.cart_id
    WHERE cart_items.id = ?
      AND carts.user_id = ?
      AND carts.status = 'active'
    LIMIT 1`,
    [itemId, userId],
  );

  return items[0] || null;
};

export const getCartItemsByCartId = async (cartId) => {
  const [items] = await pool.execute(
    `SELECT
      cart_items.id AS cart_item_id,
      cart_items.quantity,

      product_variants.id AS product_variant_id,
      product_variants.color,
      product_variants.size,
      product_variants.sku,
      product_variants.price,
      product_variants.fulfillment_type,
      product_variants.stock_quantity,
      product_variants.preorder_lead_days,
      product_variants.deposit_percentage,
      product_variants.is_active AS variant_is_active,

      products.id AS product_id,
      products.name AS product_name,
      products.slug AS product_slug,
      products.target_gender,
      products.is_active AS product_is_active,

      categories.name AS category_name
    FROM cart_items
    INNER JOIN product_variants
      ON product_variants.id = cart_items.product_variant_id
    INNER JOIN products
      ON products.id = product_variants.product_id
    INNER JOIN categories
      ON categories.id = products.category_id
    WHERE cart_items.cart_id = ?
    ORDER BY cart_items.id DESC`,
    [cartId],
  );

  return items;
};

export const deleteCartItem = async (itemId) => {
  await pool.execute(
    `DELETE FROM cart_items
    WHERE id = ?`,
    [itemId],
  );
};

export const findAvailableVariantById = async (variantId) => {
  const [variants] = await pool.execute(
    `SELECT
      product_variants.id,
      product_variants.fulfillment_type,
      product_variants.stock_quantity,
      product_variants.is_active AS variant_is_active,

      products.id AS product_id,
      products.is_active AS product_is_active
    FROM product_variants
    INNER JOIN products
      ON products.id = product_variants.product_id
    WHERE product_variants.id = ?
      AND product_variants.is_active = TRUE
      AND products.is_active = TRUE
    LIMIT 1`,
    [variantId],
  );

  return variants[0] || null;
};
