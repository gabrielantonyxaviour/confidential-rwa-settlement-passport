export const RECEIPT_GATE_CONTRACT_ID = "CCAJ3DGKJB2TKWM7BXG6I7W3NDSZD6C4EH5EADAIO6NNDL2RSU6FR3NT";
export const SETTLEMENT_CONTRACT_ID = "CDCXKGH6CKO62DPVOAZZT3SY5VWCEV2YGZTKYMTS4ZKIG7J3BSULJC7U";
export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
export const EXPLORER_TX_URL = "https://stellar.expert/explorer/testnet/tx";
export const CIRCUIT_ARTIFACT_URL = "/circuits/settlement_passport.json";

export const TRUSTED_VERIFIER_HASH_HEX =
  "3c56f0f9c4b5c720ebc0bb3c3a72a24137d0d612a32b7f14144616d73652957b";

export const DEMO_THRESHOLD = "50";
export const DEMO_RESERVE_VALUE = "75";
export const DEMO_SETTLEMENT_AMOUNT = 100n;

export function stellarExpertTxUrl(hash: string): string {
  return `${EXPLORER_TX_URL}/${hash}`;
}
