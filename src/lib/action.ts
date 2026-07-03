import { uint8ArrayToBytes32Hex } from "./bytes";

export const BN254_FIELD_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type SettlementAction = {
  actionIdBytes: Uint8Array;
  actionIdHex: string;
  actionHashField: string;
};

export async function deriveSettlementAction(walletAddress: string): Promise<SettlementAction> {
  const normalizedAddress = walletAddress.trim();

  if (!normalizedAddress) {
    throw new Error("A Stellar wallet address is required to derive the settlement action.");
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser does not support Web Crypto SHA-256.");
  }

  const digest = new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizedAddress)),
  );
  const actionHashField = (uint8ArrayToBigInt(digest) % BN254_FIELD_PRIME).toString();

  return {
    actionIdBytes: digest,
    actionIdHex: uint8ArrayToBytes32Hex(digest),
    actionHashField,
  };
}

function uint8ArrayToBigInt(bytes: Uint8Array): bigint {
  return BigInt(`0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`);
}
