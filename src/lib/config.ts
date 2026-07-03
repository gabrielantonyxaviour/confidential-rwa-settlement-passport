export const RECEIPT_GATE_CONTRACT_ID =
  "CB5G2NISIP3A4BCI3QTMZLBKCVIOFG73BCQN6KRPV32RE5I3PJYQ4VRH";
export const SETTLEMENT_CONTRACT_ID =
  "CBDPRF4V3FMRYDAKAVPGJYXBRM5YEH6TUNA5YEFUJHSFVU7FHFDGXJES";
export const ULTRAHONK_VERIFIER_CONTRACT_ID =
  "CBQZAQXEOQMMMEHS2VEMU5IT5X75ERNYWQ2RDQJWM4DYD7ZRT2MNLPLW";
export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
export const EXPLORER_TX_URL = "https://stellar.expert/explorer/testnet/tx";
export const CIRCUIT_ARTIFACT_URL = "/circuits/settlement_passport.json";

export const DEMO_THRESHOLD = "50";
export const DEMO_RESERVE_VALUE = "75";
export const DEMO_SETTLEMENT_AMOUNT = 100n;

export function stellarExpertTxUrl(hash: string): string {
  return `${EXPLORER_TX_URL}/${hash}`;
}
