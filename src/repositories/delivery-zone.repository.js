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

export const findAllForManagement = async () => {
  const [zones] = await pool.execute(
    `SELECT
      id,
      name,
      area_description,
      standard_fee,
      quick_fee,
      is_active,
      created_at,
      updated_at
    FROM delivery_zones
    ORDER BY id ASC`,
  );

  return zones;
};

export const findByName = async (name) => {
  const [zones] = await pool.execute(
    `SELECT id
    FROM delivery_zones
    WHERE name = ?
    LIMIT 1`,
    [name],
  );

  return zones[0] || null;
};

export const findById = async (zoneId) => {
  const [zones] = await pool.execute(
    `SELECT
      id,
      name,
      area_description,
      standard_fee,
      quick_fee,
      is_active,
      created_at,
      updated_at
    FROM delivery_zones
    WHERE id = ?
    LIMIT 1`,
    [zoneId],
  );

  return zones[0] || null;
};

export const createDeliveryZone = async ({
  name,
  areaDescription,
  standardFee,
  quickFee,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO delivery_zones (
      name,
      area_description,
      standard_fee,
      quick_fee
    )
    VALUES (?, ?, ?, ?)`,
    [name, areaDescription || null, standardFee, quickFee],
  );

  return {
    id: result.insertId,
    name,
    area_description: areaDescription || null,
    standard_fee: standardFee,
    quick_fee: quickFee,
    is_active: 1,
  };
};

export const updateDeliveryZone = async (
  zoneId,
  { name, areaDescription, standardFee, quickFee, isActive },
) => {
  await pool.execute(
    `UPDATE delivery_zones
    SET
      name = ?,
      area_description = ?,
      standard_fee = ?,
      quick_fee = ?,
      is_active = ?
    WHERE id = ?`,
    [name, areaDescription || null, standardFee, quickFee, isActive, zoneId],
  );
};

export const deactivateDeliveryZone = async (zoneId) => {
  await pool.execute(
    `UPDATE delivery_zones
    SET is_active = FALSE
    WHERE id = ?`,
    [zoneId],
  );
};

export const setActiveStatus = async (zoneId, isActive) => {
  await pool.execute(
    `UPDATE delivery_zones
    SET is_active = ?
    WHERE id = ?`,
    [isActive, zoneId],
  );
};
