import pool from "../helper/db_helper.js";

const buildCatalogFilters = ({
  search = "",
  category = null,
  gender = null,
}) => {
  const conditions = [
    "products.is_active = TRUE",
    "categories.is_active = TRUE",
    `EXISTS (
      SELECT 1
      FROM product_variants AS sellable_variants
      WHERE sellable_variants.product_id = products.id
        AND sellable_variants.is_active = TRUE
        AND (
          sellable_variants.fulfillment_type = 'preorder'
          OR (
            sellable_variants.fulfillment_type = 'in_stock'
            AND sellable_variants.stock_quantity > 0
          )
        )
    )`,
  ];

  const values = [];

  if (search) {
    const searchValue = `%${search}%`;

    conditions.push(`
      (
        products.name LIKE ?
        OR categories.name LIKE ?
        OR COALESCE(products.description, '') LIKE ?
      )
    `);

    values.push(searchValue, searchValue, searchValue);
  }

  if (category) {
    conditions.push("categories.slug = ?");
    values.push(category);
  }

  if (gender === "men" || gender === "women") {
    conditions.push("products.target_gender IN (?, 'unisex')");
    values.push(gender);
  }

  if (gender === "unisex") {
    conditions.push("products.target_gender = 'unisex'");
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    values,
  };
};

export const findAllForCatalog = async ({
  limit,
  offset,
  search = "",
  category = null,
  gender = null,
}) => {
  const { whereClause, values } = buildCatalogFilters({
    search,
    category,
    gender,
  });

  const [[countResult]] = await pool.execute(
    `
      SELECT COUNT(*) AS total
      FROM products
      INNER JOIN categories
        ON categories.id = products.category_id
      ${whereClause}
    `,
    values,
  );

  const [products] = await pool.execute(
    `
      SELECT
        products.id,
        products.name,
        products.slug,
        products.description,
        products.target_gender,
        categories.name AS category_name,
        categories.slug AS category_slug,

        (
          SELECT product_images.image_path
          FROM product_images
          WHERE product_images.product_id = products.id
            AND product_images.is_primary = TRUE
          ORDER BY product_images.id ASC
          LIMIT 1
        ) AS primary_image_path,

        (
          SELECT product_images.media_driver
          FROM product_images
          WHERE product_images.product_id = products.id
            AND product_images.is_primary = TRUE
          ORDER BY product_images.id ASC
          LIMIT 1
        ) AS primary_image_driver,

        (
          SELECT product_images.storage_key
          FROM product_images
          WHERE product_images.product_id = products.id
            AND product_images.is_primary = TRUE
          ORDER BY product_images.id ASC
          LIMIT 1
        ) AS primary_image_storage_key,

        (
          SELECT MIN(product_variants.price)
          FROM product_variants
          WHERE product_variants.product_id = products.id
            AND product_variants.is_active = TRUE
            AND (
              product_variants.fulfillment_type = 'preorder'
              OR (
                product_variants.fulfillment_type = 'in_stock'
                AND product_variants.stock_quantity > 0
              )
            )
        ) AS starting_price,

        EXISTS (
          SELECT 1
          FROM product_variants
          WHERE product_variants.product_id = products.id
            AND product_variants.is_active = TRUE
            AND product_variants.fulfillment_type = 'in_stock'
            AND product_variants.stock_quantity > 0
        ) AS has_in_stock,

        EXISTS (
          SELECT 1
          FROM product_variants
          WHERE product_variants.product_id = products.id
            AND product_variants.is_active = TRUE
            AND product_variants.fulfillment_type = 'preorder'
        ) AS has_preorder

      FROM products
      INNER JOIN categories
        ON categories.id = products.category_id
      ${whereClause}
      ORDER BY products.name ASC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset],
  );

  return {
    products,
    total: countResult.total,
  };
};

export const findOneForCatalogBySlug = async (slug) => {
  const [productRows] = await pool.execute(
    `
      SELECT
        products.id,
        products.name,
        products.slug,
        products.description,
        products.target_gender,
        categories.name AS category_name,
        categories.slug AS category_slug
      FROM products
      INNER JOIN categories
        ON categories.id = products.category_id
      WHERE products.slug = ?
        AND products.is_active = TRUE
        AND categories.is_active = TRUE
        AND EXISTS (
          SELECT 1
          FROM product_variants AS sellable_variants
          WHERE sellable_variants.product_id = products.id
            AND sellable_variants.is_active = TRUE
            AND (
              sellable_variants.fulfillment_type = 'preorder'
              OR (
                sellable_variants.fulfillment_type = 'in_stock'
                AND sellable_variants.stock_quantity > 0
              )
            )
        )
      LIMIT 1
    `,
    [slug],
  );

  const product = productRows[0];

  if (!product) {
    return null;
  }

  const [images] = await pool.execute(
    `
      SELECT
        id,
        product_variant_id,
        image_path,
        media_driver,
        storage_key,
        alt_text,
        sort_order,
        is_primary
      FROM product_images
      WHERE product_id = ?
      ORDER BY is_primary DESC, sort_order ASC, id ASC
    `,
    [product.id],
  );

  const [variants] = await pool.execute(
    `
      SELECT
        id,
        color,
        size,
        sku,
        price,
        fulfillment_type,
        stock_quantity,
        preorder_lead_days,
        deposit_percentage
      FROM product_variants
      WHERE product_id = ?
        AND is_active = TRUE
        AND (
          fulfillment_type = 'preorder'
          OR (
            fulfillment_type = 'in_stock'
            AND stock_quantity > 0
          )
        )
      ORDER BY
        color ASC,
        size ASC,
        FIELD(fulfillment_type, 'in_stock', 'preorder') ASC
    `,
    [product.id],
  );

  return {
    product,
    images,
    variants,
  };
};
