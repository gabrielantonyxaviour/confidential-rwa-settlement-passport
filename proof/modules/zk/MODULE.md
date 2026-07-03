# ZK Module

Use only when the project includes zero-knowledge proofs, circuits, witnesses,
verifiers, or proof-gated actions.

## Rules

- ZK must be load-bearing, not decorative.
- Under-constrained circuit checks are mandatory.
- Valid proof must verify.
- Tampered proof/public input/invalid witness must fail.
- On-chain verifier integration must be tested when the hackathon requires
  on-chain proof.

## Required Checks

| Check | Required proof |
|---|---|
| Circuit/unit tests | Native circuit tests pass |
| Under-constraint scan | circomspect/nargo equivalent clean |
| Witness generation | Valid witness generated |
| Valid proof | Proof verifies |
| Invalid witness | Rejected |
| Tampered public input | Rejected |
| Setup integrity | zkey/verifier setup verification if Groth16 |
| Proof timing | Prove/verify time recorded |
| On-chain verifier | Valid calldata accepted, tampered calldata rejected |

## Failure Tests

- Private input accidentally public.
- Public input tampering.
- Proof tampering.
- Missing constraint.
- Setup missing final contribution.
- Verifier accepts malformed calldata.

