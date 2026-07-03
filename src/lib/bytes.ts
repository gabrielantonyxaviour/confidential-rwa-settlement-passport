import { nativeToScVal, xdr } from "@stellar/stellar-sdk";

export type Bytes32Hex = string;

export function stripHexPrefix(value: string): string {
  return value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
}

export function normalizeBytes32Hex(value: string): Bytes32Hex {
  const hex = stripHexPrefix(value).toLowerCase();

  if (!/^[0-9a-f]+$/.test(hex)) {
    throw new Error("Expected a hexadecimal value.");
  }

  if (hex.length > 64) {
    throw new Error("Expected a 32-byte value, but the hexadecimal value is longer than 32 bytes.");
  }

  return hex.padStart(64, "0");
}

export function fieldToBytes32Hex(value: string | number | bigint): Bytes32Hex {
  return normalizeBytes32Hex(BigInt(value).toString(16));
}

export function bytes32HexToUint8Array(value: string): Uint8Array {
  const hex = normalizeBytes32Hex(value);
  const bytes = new Uint8Array(32);

  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }

  return bytes;
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function uint8ArrayToBytes32Hex(bytes: Uint8Array): Bytes32Hex {
  if (bytes.length !== 32) {
    throw new Error("Expected exactly 32 bytes.");
  }

  return normalizeBytes32Hex(uint8ArrayToHex(bytes));
}

export function bytes32HexToScVal(value: string): xdr.ScVal {
  return nativeToScVal(bytes32HexToUint8Array(value), { type: "bytes" });
}

export function shortHex(value: string): string {
  const hex = normalizeBytes32Hex(value);
  return `${hex.slice(0, 8)}...${hex.slice(-8)}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}
