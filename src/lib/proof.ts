import type { CompiledCircuit, InputMap, ProofData } from "@noir-lang/types";
import {
  BN254_FIELD_PRIME,
  deriveSettlementAction,
  type SettlementAction,
} from "./action";
import { normalizeBytes32Hex } from "./bytes";
import { CIRCUIT_ARTIFACT_URL, DEMO_THRESHOLD } from "./config";

export type SettlementProofInputs = {
  leaf: string;
  sibling_0: string;
  sibling_1: string;
  sibling_0_on_left: boolean;
  sibling_1_on_left: boolean;
  reserve_value: string;
  threshold: string;
  credential_root: string;
  action_hash: string;
  nullifier: string;
};

export type SettlementCredentialInputs = Omit<
  SettlementProofInputs,
  "action_hash" | "nullifier"
>;

export type SettlementProofResult = ProofData & {
  threshold: string;
  credentialRoot: string;
  nullifier: string;
  buyerAddress: string;
  actionIdHex: string;
  actionHashField: string;
};

type PedersenApi = {
  pedersenHash(inputs: FrLike[], hashIndex: number): Promise<FrLike>;
};

type FrConstructor = new (value: bigint) => FrLike;

type FrLike = {
  toString(): string;
};

export const DEMO_CREDENTIAL_INPUTS: SettlementCredentialInputs = {
  leaf: "11",
  sibling_0: "22",
  sibling_1: "33",
  sibling_0_on_left: false,
  sibling_1_on_left: true,
  reserve_value: "75",
  threshold: DEMO_THRESHOLD,
  credential_root:
    "0x2c9754da3b2f3b3aabc5b9177cfb6109226f6c7daf802afcc4513e9391bdc327",
};

let circuitArtifactPromise: Promise<CompiledCircuit> | null = null;

export async function generateSettlementProof(
  buyerAddress: string,
  credentialInputs: SettlementCredentialInputs = DEMO_CREDENTIAL_INPUTS,
): Promise<SettlementProofResult> {
  return generateSettlementProofFromCircuit(
    await loadCircuitArtifact(),
    buyerAddress,
    credentialInputs,
  );
}

export async function generateSettlementProofFromCircuit(
  circuit: CompiledCircuit,
  buyerAddress: string,
  credentialInputs: SettlementCredentialInputs = DEMO_CREDENTIAL_INPUTS,
): Promise<SettlementProofResult> {
  const [{ Noir }, { Barretenberg, Fr, UltraHonkBackend }] = await Promise.all([
    import("@noir-lang/noir_js"),
    import("@aztec/bb.js"),
  ]);
  const noir = new Noir(circuit);
  const api = await Barretenberg.new({ threads: 1 });
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });

  try {
    const { inputs, action } = await buildProofInputs(
      api,
      Fr,
      buyerAddress,
      credentialInputs,
    );
    const { witness } = await noir.execute(toNoirInputMap(inputs));
    const proofData = await backend.generateProof(witness, { keccak: true });
    return normalizeProofResult(proofData, action, buyerAddress.trim());
  } finally {
    await api.destroy();
    await backend.destroy();
  }
}

export async function verifySettlementProofFromCircuit(
  circuit: CompiledCircuit,
  proofData: ProofData,
): Promise<boolean> {
  const { UltraHonkBackend } = await import("@aztec/bb.js");
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });

  try {
    return backend.verifyProof(proofData, { keccak: true });
  } finally {
    await backend.destroy();
  }
}

async function loadCircuitArtifact(): Promise<CompiledCircuit> {
  circuitArtifactPromise ??= fetch(CIRCUIT_ARTIFACT_URL).then(
    async (response) => {
      if (!response.ok) {
        throw new Error(
          "The settlement passport circuit artifact could not be loaded.",
        );
      }

      return (await response.json()) as CompiledCircuit;
    },
  );

  return circuitArtifactPromise;
}

async function buildProofInputs(
  api: PedersenApi,
  Fr: FrConstructor,
  buyerAddress: string,
  credentialInputs: SettlementCredentialInputs,
): Promise<{ inputs: SettlementProofInputs; action: SettlementAction }> {
  const action = await deriveSettlementAction(buyerAddress);
  const nullifier = await pedersenHashFields(
    api,
    Fr,
    credentialInputs.leaf,
    action.actionHashField,
  );

  return {
    action,
    inputs: {
      ...credentialInputs,
      action_hash: action.actionHashField,
      nullifier,
    },
  };
}

async function pedersenHashFields(
  api: PedersenApi,
  Fr: FrConstructor,
  left: string,
  right: string,
): Promise<string> {
  const response = await api.pedersenHash(
    [fieldToFr(Fr, left), fieldToFr(Fr, right)],
    0,
  );

  return `0x${normalizeBytes32Hex(response.toString())}`;
}

function fieldToFr(Fr: FrConstructor, value: string): FrLike {
  const field = BigInt(value);

  if (field < 0n || field >= BN254_FIELD_PRIME) {
    throw new Error("Expected a BN254 field element.");
  }

  return new Fr(field);
}

function toNoirInputMap(inputs: SettlementProofInputs): InputMap {
  return {
    leaf: inputs.leaf,
    sibling_0: inputs.sibling_0,
    sibling_1: inputs.sibling_1,
    sibling_0_on_left: inputs.sibling_0_on_left,
    sibling_1_on_left: inputs.sibling_1_on_left,
    reserve_value: inputs.reserve_value,
    threshold: inputs.threshold,
    credential_root: inputs.credential_root,
    action_hash: inputs.action_hash,
    nullifier: inputs.nullifier,
  };
}

function normalizeProofResult(
  proofData: ProofData,
  action: SettlementAction,
  buyerAddress: string,
): SettlementProofResult {
  const [threshold, credentialRoot, nullifier] = proofData.publicInputs;

  if (!threshold || !credentialRoot || !nullifier) {
    throw new Error(
      "The settlement passport proof did not return the expected public inputs.",
    );
  }

  return {
    ...proofData,
    threshold: BigInt(`0x${normalizeBytes32Hex(threshold)}`).toString(),
    credentialRoot: normalizeBytes32Hex(credentialRoot),
    nullifier: normalizeBytes32Hex(nullifier),
    buyerAddress,
    actionIdHex: action.actionIdHex,
    actionHashField: action.actionHashField,
  };
}

/*
 * MVP limitation:
 * There is no credential-issuance backend in this Level 4 demo yet. The browser
 * proves one fixed credential witness (leaf=11, siblings=22/33, reserve=75)
 * against the already-compiled Noir circuit. This still demonstrates the core
 * product claim: private reserve and membership data stay off-chain while only
 * credential_root and nullifier are used by the Stellar contracts.
 */
