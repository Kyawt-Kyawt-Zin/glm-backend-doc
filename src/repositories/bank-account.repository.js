import pool from "../helper/db_helper.js";

export const findAllActive = async () => {
  const [accounts] = await pool.execute(
    `SELECT
      id,
      label,
      bank_name,
      account_holder,
      account_number,
      iban,
      branch_name,
      currency,
      transfer_instructions,
      display_order
    FROM bank_accounts
    WHERE is_active = TRUE
    ORDER BY display_order ASC, id ASC`,
  );

  return accounts;
};

export const findAllForManagement = async () => {
  const [accounts] = await pool.execute(
    `SELECT
      id,
      label,
      bank_name,
      account_holder,
      account_number,
      iban,
      branch_name,
      currency,
      transfer_instructions,
      is_active,
      display_order,
      created_at,
      updated_at
    FROM bank_accounts
    ORDER BY display_order ASC, id ASC`,
  );

  return accounts;
};

export const findById = async (accountId) => {
  const [accounts] = await pool.execute(
    `SELECT
      id,
      label,
      bank_name,
      account_holder,
      account_number,
      iban,
      branch_name,
      currency,
      transfer_instructions,
      is_active,
      display_order,
      created_at,
      updated_at
    FROM bank_accounts
    WHERE id = ?
    LIMIT 1`,
    [accountId],
  );

  return accounts[0] || null;
};

export const createBankAccount = async ({
  label,
  bankName,
  accountHolder,
  accountNumber,
  iban,
  branchName,
  currency,
  transferInstructions,
  displayOrder,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO bank_accounts (
      label,
      bank_name,
      account_holder,
      account_number,
      iban,
      branch_name,
      currency,
      transfer_instructions,
      display_order
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      label,
      bankName,
      accountHolder,
      accountNumber,
      iban || null,
      branchName || null,
      currency,
      transferInstructions || null,
      displayOrder,
    ],
  );

  return result.insertId;
};

export const updateBankAccount = async (
  accountId,
  {
    label,
    bankName,
    accountHolder,
    accountNumber,
    iban,
    branchName,
    currency,
    transferInstructions,
    displayOrder,
  },
) => {
  await pool.execute(
    `UPDATE bank_accounts
    SET
      label = ?,
      bank_name = ?,
      account_holder = ?,
      account_number = ?,
      iban = ?,
      branch_name = ?,
      currency = ?,
      transfer_instructions = ?,
      display_order = ?
    WHERE id = ?`,
    [
      label,
      bankName,
      accountHolder,
      accountNumber,
      iban || null,
      branchName || null,
      currency,
      transferInstructions || null,
      displayOrder,
      accountId,
    ],
  );
};

export const setActiveStatus = async (accountId, isActive) => {
  await pool.execute(
    `UPDATE bank_accounts
    SET is_active = ?
    WHERE id = ?`,
    [isActive, accountId],
  );
};
