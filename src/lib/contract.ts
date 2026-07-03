import {
  Account,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  RECEIPT_GATE_CONTRACT_ID,
  SETTLEMENT_CONTRACT_ID,
  SOROBAN_RPC_URL,
  stellarExpertTxUrl,
} from "./config";
import {
  bytes32HexToScVal,
  bytesToScVal,
  hexFieldsToUint8Array,
  normalizeBytes32Hex,
} from "./bytes";
import { normalizeContractError } from "./errors";
import type { SettlementProofResult } from "./proof";
import type { SignTransaction } from "./wallet-kit";

export { stellarExpertTxUrl };

const server = new rpc.Server(SOROBAN_RPC_URL);
const receiptGateContract = new Contract(RECEIPT_GATE_CONTRACT_ID);
const settlementContract = new Contract(SETTLEMENT_CONTRACT_ID);
const READ_ONLY_SOURCE =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export async function recordPass(
  voterAddress: string,
  credentialRoot: string,
  nullifier: string,
  actionId: string,
  proof: SettlementProofResult,
  signTransaction: SignTransaction,
): Promise<{ hash: string }> {
  const publicInputs = hexFieldsToUint8Array(proof.publicInputs);

  try {
    return await submitContractOperation(
      voterAddress,
      receiptGateContract.call(
        "record_pass",
        bytes32HexToScVal(normalizeBytes32Hex(credentialRoot)),
        bytes32HexToScVal(normalizeBytes32Hex(nullifier)),
        bytes32HexToScVal(normalizeBytes32Hex(actionId)),
        bytesToScVal(publicInputs),
        bytesToScVal(proof.proof),
      ),
      signTransaction,
      "receipt_gate",
    );
  } catch (error) {
    throw new Error(normalizeContractError(error, "receipt_gate"));
  }
}

export async function settle(
  buyerAddress: string,
  nullifier: string,
  actionId: string,
  amount: bigint,
  signTransaction: SignTransaction,
): Promise<{ hash: string }> {
  try {
    return await submitContractOperation(
      buyerAddress,
      settlementContract.call(
        "settle",
        nativeToScVal(buyerAddress, { type: "address" }),
        bytes32HexToScVal(normalizeBytes32Hex(nullifier)),
        bytes32HexToScVal(normalizeBytes32Hex(actionId)),
        nativeToScVal(amount, { type: "i128" }),
      ),
      signTransaction,
      "settlement",
    );
  } catch (error) {
    throw new Error(normalizeContractError(error, "settlement"));
  }
}

export async function getBalance(address: string): Promise<bigint> {
  const retval = await simulateReadOnly(
    settlementContract.call(
      "balance",
      nativeToScVal(address, { type: "address" }),
    ),
  );
  return BigInt(scValToNative(retval));
}

async function submitContractOperation(
  sourceAddress: string,
  operation: xdr.Operation,
  signTransaction: SignTransaction,
  contractContext: "receipt_gate" | "settlement",
): Promise<{ hash: string }> {
  const sourceAccount = await server.getAccount(sourceAddress);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  let preparedTransaction;
  try {
    preparedTransaction = await server.prepareTransaction(transaction);
  } catch (error) {
    throw new Error(normalizeContractError(error, contractContext));
  }

  const signed = await signTransaction(preparedTransaction.toXDR(), {
    networkPassphrase: Networks.TESTNET,
    address: sourceAddress,
  });
  const signedTransaction = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    Networks.TESTNET,
  );
  const sendResponse = await server.sendTransaction(signedTransaction);

  if (sendResponse.status === "ERROR") {
    throw new Error(
      normalizeContractError(sendResponse.errorResult, contractContext),
    );
  }

  if (sendResponse.status === "TRY_AGAIN_LATER") {
    throw new Error(
      "The Stellar testnet asked us to try again later. Wait a moment and retry.",
    );
  }

  const hash = sendResponse.hash;
  const confirmation = await server.pollTransaction(hash, {
    attempts: 30,
    sleepStrategy: () => 1000,
  });

  if (confirmation.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(
      normalizeContractError(confirmation.resultXdr, contractContext),
    );
  }

  if (confirmation.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(
      "The transaction was submitted but was not confirmed before polling timed out.",
    );
  }

  return { hash };
}

async function simulateReadOnly(operation: xdr.Operation): Promise<xdr.ScVal> {
  const sourceAccount = new Account(READ_ONLY_SOURCE, "0");
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(normalizeContractError(simulation.error));
  }

  if (!simulation.result?.retval) {
    throw new Error("The settlement contract did not return a balance.");
  }

  return simulation.result.retval;
}
