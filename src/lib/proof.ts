import type { CompiledCircuit, InputMap, ProofData } from "@noir-lang/types";
import { BN254_FIELD_PRIME, deriveSettlementAction, type SettlementAction } from "./action";
import { uint8ArrayToBytes32Hex, normalizeBytes32Hex } from "./bytes";
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

export type SettlementCredentialInputs = Omit<SettlementProofInputs, "action_hash" | "nullifier">;

export type SettlementProofResult = ProofData & {
  threshold: string;
  credentialRoot: string;
  nullifier: string;
  buyerAddress: string;
  actionIdHex: string;
  actionHashField: string;
};

type PedersenApi = {
  pedersenHash(command: { inputs: Uint8Array[]; hashIndex: number }): Promise<{ hash: Uint8Array }>;
};

export const DEMO_CREDENTIAL_INPUTS: SettlementCredentialInputs = {
  leaf: "11",
  sibling_0: "22",
  sibling_1: "33",
  sibling_0_on_left: false,
  sibling_1_on_left: true,
  reserve_value: "75",
  threshold: DEMO_THRESHOLD,
  credential_root: "0x2c9754da3b2f3b3aabc5b9177cfb6109226f6c7daf802afcc4513e9391bdc327",
};

let circuitArtifactPromise: Promise<CompiledCircuit> | null = null;

export async function generateSettlementProof(
  buyerAddress: string,
  credentialInputs: SettlementCredentialInputs = DEMO_CREDENTIAL_INPUTS,
): Promise<SettlementProofResult> {
  return generateSettlementProofFromCircuit(await loadCircuitArtifact(), buyerAddress, credentialInputs);
}

export async function generateSettlementProofFromCircuit(
  circuit: CompiledCircuit,
  buyerAddress: string,
  credentialInputs: SettlementCredentialInputs = DEMO_CREDENTIAL_INPUTS,
): Promise<SettlementProofResult> {
  const [{ Noir }, { BackendType, Barretenberg, UltraHonkBackend }] = await Promise.all([
    import("@noir-lang/noir_js"),
    import("@aztec/bb.js"),
  ]);
  const noir = new Noir(circuit);
  const api = await Barretenberg.new({
    backend: BackendType.Wasm,
    threads: 1,
  });

  try {
    const { inputs, action } = await buildProofInputs(api, buyerAddress, credentialInputs);
    const { witness } = await noir.execute(toNoirInputMap(inputs));
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    const proofData = await backend.generateProof(witness);
    return normalizeProofResult(proofData, action, buyerAddress.trim());
  } finally {
    await api.destroy();
  }
}

export async function verifySettlementProofFromCircuit(
  circuit: CompiledCircuit,
  proofData: ProofData,
): Promise<boolean> {
  const { BackendType, Barretenberg, UltraHonkBackend } = await import("@aztec/bb.js");
  const api = await Barretenberg.new({
    backend: BackendType.Wasm,
    threads: 1,
  });

  try {
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    return backend.verifyProof(proofData);
  } finally {
    await api.destroy();
  }
}

async function loadCircuitArtifact(): Promise<CompiledCircuit> {
  circuitArtifactPromise ??= fetch(CIRCUIT_ARTIFACT_URL).then(async (response) => {
    if (!response.ok) {
      throw new Error("The settlement passport circuit artifact could not be loaded.");
    }

    return (await response.json()) as CompiledCircuit;
  });

  return circuitArtifactPromise;
}

async function buildProofInputs(
  api: PedersenApi,
  buyerAddress: string,
  credentialInputs: SettlementCredentialInputs,
): Promise<{ inputs: SettlementProofInputs; action: SettlementAction }> {
  const action = await deriveSettlementAction(buyerAddress);
  const nullifier = await pedersenHashFields(api, credentialInputs.leaf, action.actionHashField);

  return {
    action,
    inputs: {
      ...credentialInputs,
      action_hash: action.actionHashField,
      nullifier,
    },
  };
}

async function pedersenHashFields(api: PedersenApi, left: string, right: string): Promise<string> {
  const response = await api.pedersenHash({
    inputs: [fieldToBigEndianBytes(left), fieldToBigEndianBytes(right)],
    hashIndex: 0,
  });

  return `0x${uint8ArrayToBytes32Hex(response.hash)}`;
}

function fieldToBigEndianBytes(value: string): Uint8Array {
  const field = BigInt(value);

  if (field < 0n || field >= BN254_FIELD_PRIME) {
    throw new Error("Expected a BN254 field element.");
  }

  const bytes = new Uint8Array(32);
  let remaining = field;

  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return bytes;
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
    throw new Error("The settlement passport proof did not return the expected public inputs.");
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
