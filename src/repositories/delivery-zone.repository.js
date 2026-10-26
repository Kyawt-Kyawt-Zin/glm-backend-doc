import pool from "../helper/db_helper.js";

export const findActiveById = async (zoneId) => {
  const [zones] = await pool.execute(
    `SELECT
      id,
      name,
      area_description,
      standard_fee,
      quick_fee
    FROM delivery_zones
    WHERE id = ?
      AND is_active = TRUE
    LIMIT 1`,
    [zoneId],
  );

  return zones[0] || null;
};

export const findAllActive = async () => {
  const [zones] = await pool.execute(
    `SELECT
      id,
      name,
      area_description,
      standard_fee,
      quick_fee
    FROM delivery_zones
    WHERE is_active = TRUE
    ORDER BY id ASC`,
  );

  return zones;
};
