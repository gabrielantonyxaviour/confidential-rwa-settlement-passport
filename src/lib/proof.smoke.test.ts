import { describe, expect, it } from "vitest";
import type { CompiledCircuit } from "@noir-lang/types";
import circuitArtifact from "../../public/circuits/settlement_passport.json";
import {
  DEMO_CREDENTIAL_INPUTS,
  generateSettlementProofFromCircuit,
  verifySettlementProofFromCircuit,
} from "./proof";

const BUYER_ADDRESS_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const BUYER_ADDRESS_B = "GBL32CFUIH4WVIBYHHEW7HQBZ5M3XGOBGGLDULAK6AI3RR6NQ7RWAONE";

describe("generateSettlementProof", () => {
  it(
    "derives distinct action-scoped nullifiers for distinct buyers",
    async () => {
      const circuit = circuitArtifact as CompiledCircuit;
      const first = await generateSettlementProofFromCircuit(circuit, BUYER_ADDRESS_A);
      const second = await generateSettlementProofFromCircuit(circuit, BUYER_ADDRESS_B);

      expect(first.proof.length).toBeGreaterThan(0);
      expect(second.proof.length).toBeGreaterThan(0);
      expect(first.publicInputs).toHaveLength(3);
      expect(second.publicInputs).toHaveLength(3);
      expect(first.threshold).toBe(DEMO_CREDENTIAL_INPUTS.threshold);
      expect(second.threshold).toBe(DEMO_CREDENTIAL_INPUTS.threshold);
      expect(first.credentialRoot).toBe(DEMO_CREDENTIAL_INPUTS.credential_root.slice(2));
      expect(second.credentialRoot).toBe(DEMO_CREDENTIAL_INPUTS.credential_root.slice(2));
      expect(first.buyerAddress).toBe(BUYER_ADDRESS_A);
      expect(second.buyerAddress).toBe(BUYER_ADDRESS_B);
      expect(first.actionIdHex).not.toBe(second.actionIdHex);
      expect(first.actionHashField).not.toBe(second.actionHashField);
      expect(first.nullifier).not.toBe(second.nullifier);
      expect(await verifySettlementProofFromCircuit(circuit, first)).toBe(true);
      expect(await verifySettlementProofFromCircuit(circuit, second)).toBe(true);
    },
    360_000,
  );
});
