import { xdr } from "@stellar/stellar-sdk";

type ContractContext = "receipt_gate" | "settlement" | "unknown";

type XdrEnumLike = {
  name?: string;
  value?: number;
};

type DecodedTransactionError = {
  transactionCode?: string;
  transactionCodeValue?: number;
  operationCode?: string;
  operationCodeValue?: number;
  invokeCode?: string;
  invokeCodeValue?: number;
};

export function normalizeContractError(rawError?: unknown, context: ContractContext = "unknown"): string {
  try {
    return normalizeContractErrorUnsafe(rawError, context);
  } catch {
    return "The Stellar contract rejected the transaction.";
  }
}

export function normalizeWalletError(error: unknown): Error {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("not found") ||
    lowerMessage.includes("not installed") ||
    lowerMessage.includes("unavailable") ||
    lowerMessage.includes("could not find") ||
    lowerMessage.includes("no wallet")
  ) {
    return new Error("Wallet not found. Install or enable Freighter, then try connecting again.");
  }

  if (
    lowerMessage.includes("reject") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("cancel") ||
    lowerMessage.includes("closed")
  ) {
    return new Error("Connection rejected. Open the Freighter prompt and approve the request to continue.");
  }

  return new Error(message || "Wallet connection failed. Check Freighter and try again.");
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }

  return "";
}

function normalizeContractErrorUnsafe(rawError: unknown, context: ContractContext): string {
  if (rawError instanceof xdr.TransactionResult) {
    return normalizeTransactionResultError(rawError, context);
  }

  const message = getErrorMessage(rawError);
  const decodedResult = decodeTransactionResult(message);
  if (decodedResult) {
    return normalizeTransactionResultError(decodedResult, context);
  }

  const lowerMessage = message.toLowerCase();
  const contractCode = parseContractErrorCode(message);

  if (contractCode !== undefined) {
    return contractErrorMessage(contractCode, context);
  }

  if (
    lowerMessage.includes("insufficient") ||
    lowerMessage.includes("underfunded") ||
    lowerMessage.includes("txinsufficientbalance") ||
    lowerMessage.includes("fee")
  ) {
    return "This wallet does not have enough testnet XLM to pay the transaction fee.";
  }

  if (lowerMessage.includes("too late")) {
    return "The transaction expired before it could be confirmed. Approve the wallet request faster and try again.";
  }

  if (lowerMessage.includes("bad auth") || lowerMessage.includes("opbadauth") || lowerMessage.includes("txbadauth")) {
    return "The wallet signature was rejected. Reconnect Freighter and approve the transaction again.";
  }

  if (lowerMessage.includes("hosterror") || lowerMessage.includes("contracterror")) {
    return "The Stellar contract rejected the transaction.";
  }

  if (looksLikeBase64Xdr(message)) {
    return "The Stellar contract rejected the transaction.";
  }

  return message || "The Stellar contract rejected the transaction.";
}

function normalizeTransactionResultError(result: xdr.TransactionResult, context: ContractContext): string {
  const decoded = decodeTransactionError(result);

  if (decoded.transactionCode === "txTooLate") {
    return "The transaction expired before it could be confirmed. Approve the wallet request faster and try again.";
  }

  if (decoded.transactionCode === "txInsufficientBalance" || decoded.transactionCode === "txInsufficientFee") {
    return "This wallet does not have enough testnet XLM to pay the transaction fee.";
  }

  if (decoded.operationCode === "opBadAuth" || decoded.transactionCode === "txBadAuth") {
    return "The wallet signature was rejected. Reconnect Freighter and approve the transaction again.";
  }

  if (decoded.invokeCode === "invokeHostFunctionTrapped") {
    return context === "unknown"
      ? "The Stellar contract rejected the transaction."
      : `The ${contextLabel(context)} contract rejected the transaction.`;
  }

  const code = decoded.invokeCode ?? decoded.operationCode ?? decoded.transactionCode;
  const codeValue = decoded.invokeCodeValue ?? decoded.operationCodeValue ?? decoded.transactionCodeValue;

  if (code) {
    return `The Stellar transaction failed. (code: ${code}${codeValue === undefined ? "" : `/${codeValue}`})`;
  }

  return "The Stellar contract rejected the transaction.";
}

function decodeTransactionError(result: xdr.TransactionResult): DecodedTransactionError {
  const transactionCode = enumInfo(result.result().switch());
  const decoded: DecodedTransactionError = {
    transactionCode: transactionCode.name,
    transactionCodeValue: transactionCode.value,
  };

  if (transactionCode.name !== "txFailed") {
    return decoded;
  }

  const operationResult = result.result().results()?.[0];
  if (!operationResult) {
    return decoded;
  }

  const operationCode = enumInfo(operationResult.switch());
  decoded.operationCode = operationCode.name;
  decoded.operationCodeValue = operationCode.value;

  if (operationCode.name !== "opInner") {
    return decoded;
  }

  const operationInner = operationResult.tr();
  const operationInnerCode = enumInfo(operationInner.switch());
  decoded.operationCode = operationInnerCode.name;
  decoded.operationCodeValue = operationInnerCode.value;

  if (operationInnerCode.name !== "invokeHostFunction") {
    return decoded;
  }

  const invokeCode = enumInfo(operationInner.invokeHostFunctionResult().switch());
  decoded.invokeCode = invokeCode.name;
  decoded.invokeCodeValue = invokeCode.value;

  return decoded;
}

function decodeTransactionResult(rawError?: string): xdr.TransactionResult | undefined {
  if (!rawError || !looksLikeBase64Xdr(rawError)) {
    return undefined;
  }

  try {
    const result = xdr.TransactionResult.fromXDR(rawError, "base64");
    result.result().switch();
    return result;
  } catch {
    return undefined;
  }
}

function contractErrorMessage(code: number, context: ContractContext): string {
  if (context === "receipt_gate") {
    switch (code) {
      case 2:
        return "Bad verifier evidence. The proof was generated for a different verifying key than the trusted receipt gate.";
      case 3:
        return "This nullifier already has a settlement-pass receipt for the demo action.";
      case 4:
        return "No settlement-pass receipt exists for this nullifier and action yet.";
    }
  }

  if (context === "settlement") {
    switch (code) {
      case 2:
        return "Insufficient settlement balance for this demo amount.";
      case 3:
        return "This nullifier/action pair has already been settled.";
      case 4:
        return "Receipt not verified. Record the eligibility pass before settling.";
    }
  }

  switch (code) {
    case 2:
      return "The contract rejected the request because verifier evidence or settlement balance is invalid.";
    case 3:
      return "This demo action has already been recorded or settled for the same nullifier.";
    case 4:
      return "The required settlement-pass receipt was not found or not verified.";
    default:
      return `The Stellar contract rejected the transaction. (contract error #${code})`;
  }
}

function parseContractErrorCode(message: string): number | undefined {
  const patterns = [/#(\d+)/, /error\(contract,\s*#?(\d+)\)/i, /contracterror\((\d+)\)/i, /error\((\d+)\)/i];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return undefined;
}

function contextLabel(context: ContractContext): string {
  return context === "receipt_gate" ? "receipt gate" : "settlement";
}

function enumInfo(value: XdrEnumLike): Required<XdrEnumLike> {
  return {
    name: value.name ?? "unknown",
    value: value.value ?? 0,
  };
}

function looksLikeBase64Xdr(value: string): boolean {
  return value.length >= 16 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}
