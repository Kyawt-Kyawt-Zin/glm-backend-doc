import * as Response from "../config/response.helper.js";
import * as bankAccountRepository from "../repositories/bank-account.repository.js";

const isPositiveInteger = (value) => {
  return Number.isInteger(Number(value)) && Number(value) > 0;
};

const formatAccountForManagement = (account) => {
  return {
    ...account,
    is_active: Boolean(account.is_active),
    display_order: Number(account.display_order),
  };
};

const formatActiveAccount = (account) => {
  return {
    ...account,
    display_order: Number(account.display_order),
  };
};

const validateBankAccountData = (accountData) => {
  const label = String(accountData?.label || "").trim();
  const bankName = String(accountData?.bankName || "").trim();
  const accountHolder = String(accountData?.accountHolder || "").trim();
  const accountNumber = String(accountData?.accountNumber || "").trim();
  const iban = String(accountData?.iban || "").trim();
  const branchName = String(accountData?.branchName || "").trim();
  const currency = String(accountData?.currency || "AED")
    .trim()
    .toUpperCase();
  const transferInstructions = String(
    accountData?.transferInstructions || "",
  ).trim();
  const displayOrder = Number(accountData?.displayOrder ?? 0);

  if (!label || !bankName || !accountHolder || !accountNumber) {
    return {
      error:
        "Label, bank name, account holder, and account number are required",
    };
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    return {
      error: "Currency must be a three-letter code such as AED",
    };
  }

  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    return {
      error: "Display order must be a whole number of zero or more",
    };
  }

  return {
    data: {
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
  };
};

export const getActiveBankAccounts = async () => {
  try {
    const accounts = await bankAccountRepository.findAllActive();

    return Response.success(
      accounts.map(formatActiveAccount),
      "Active bank accounts fetched successfully",
    );
  } catch (error) {
    console.error("getActiveBankAccounts service error:", error.message);

    return Response.internalServerError("Unable to fetch bank accounts");
  }
};

export const getBankAccountsForManagement = async () => {
  try {
    const accounts = await bankAccountRepository.findAllForManagement();

    return Response.success(
      accounts.map(formatAccountForManagement),
      "Bank accounts fetched successfully",
    );
  } catch (error) {
    console.error("getBankAccountsForManagement service error:", error.message);

    return Response.internalServerError("Unable to fetch bank accounts");
  }
};

export const createBankAccount = async (accountData) => {
  const validation = validateBankAccountData(accountData);

  if (validation.error) {
    return Response.badRequest(validation.error);
  }

  try {
    const accountId = await bankAccountRepository.createBankAccount(
      validation.data,
    );

    const createdAccount = await bankAccountRepository.findById(accountId);

    return Response.created(
      formatAccountForManagement(createdAccount),
      "Bank account created successfully",
    );
  } catch (error) {
    console.error("createBankAccount service error:", error.message);

    return Response.internalServerError("Unable to create bank account");
  }
};

export const updateBankAccount = async (accountId, accountData) => {
  const numericAccountId = Number(accountId);

  if (!isPositiveInteger(numericAccountId)) {
    return Response.badRequest(
      "Bank account ID must be a positive whole number",
    );
  }

  const validation = validateBankAccountData(accountData);

  if (validation.error) {
    return Response.badRequest(validation.error);
  }

  try {
    const currentAccount =
      await bankAccountRepository.findById(numericAccountId);

    if (!currentAccount) {
      return Response.notFound("Bank account not found");
    }

    await bankAccountRepository.updateBankAccount(
      numericAccountId,
      validation.data,
    );

    const updatedAccount =
      await bankAccountRepository.findById(numericAccountId);

    return Response.success(
      formatAccountForManagement(updatedAccount),
      "Bank account updated successfully",
    );
  } catch (error) {
    console.error("updateBankAccount service error:", error.message);

    return Response.internalServerError("Unable to update bank account");
  }
};

export const setBankAccountActiveStatus = async (accountId, isActive) => {
  const numericAccountId = Number(accountId);

  if (!isPositiveInteger(numericAccountId)) {
    return Response.badRequest(
      "Bank account ID must be a positive whole number",
    );
  }

  if (typeof isActive !== "boolean") {
    return Response.badRequest("isActive must be true or false");
  }

  try {
    const account = await bankAccountRepository.findById(numericAccountId);

    if (!account) {
      return Response.notFound("Bank account not found");
    }

    if (Boolean(account.is_active) === isActive) {
      return Response.success(
        formatAccountForManagement(account),
        `Bank account is already ${isActive ? "active" : "inactive"}`,
      );
    }

    await bankAccountRepository.setActiveStatus(numericAccountId, isActive);

    const updatedAccount =
      await bankAccountRepository.findById(numericAccountId);

    return Response.success(
      formatAccountForManagement(updatedAccount),
      `Bank account ${isActive ? "activated" : "deactivated"} successfully`,
    );
  } catch (error) {
    console.error("setBankAccountActiveStatus service error:", error.message);

    return Response.internalServerError("Unable to update bank account status");
  }
};
