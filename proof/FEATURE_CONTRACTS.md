# Feature Contracts

Project: Confidential RWA Settlement Passport
Hackathon: Stellar Hacks: Real-World ZK (`stellar-zk-hackathon`)
Date: 2026-07-01

## Contract Rules

- Every feature has a stable port/interface before implementation.
- Every port has mock and live adapters when it touches an external system.
- Tests are written before implementation (TDD: red → green → refactor).
- Contract/schema tests must pass before any UI wiring.
- Risky seams use batches of 1; low-risk read seams may batch 3-5.
- ZK must be load-bearing: the proof result is the gate, not a display.

## Feature Matrix

| ID | Feature | Product proof moment | Port/interface | Contract/schema | Mock adapter | Live adapter | Headless tests | Failure tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| F001 | Credential issuance fixture | Issuer commits a buyer credential into a Merkle tree | `CredentialPort` | `Credential`, `CredentialRoot` | in-memory tree | (none needed) | issue → root stable | dup credential rejected | pending |
| F002 | Eligibility proof generation | Buyer proves membership + reserve/risk threshold privately | `ProofPort` | `ProofRequest`, `ProofReceipt` | deterministic mock prover | Noir/Circom prover | valid witness → proof | invalid witness rejected; tampered public input rejected | pending |
| F003 | Soroban verifier + receipt | Chain records settlement-pass receipt, rejects replay | `VerifierPort` | `{settlement_passed, credential_root, nullifier, asset_id, action_id}` | mock contract | Soroban testnet contract | valid proof → pass receipt | tampered calldata rejected; duplicate nullifier rejected | pending |
| F004 | Gated settlement | Tokenized invoice-note transfer only after pass receipt | `SettlementPort` | `SettlementIntent`, `SettlementReceipt` | mock ledger | Soroban SAC transfer | pass → transfer executes | settlement blocked until verified | pending |

## Feature Contract Template

### F002: Eligibility proof generation (the load-bearing ZK)

Purpose: privately prove the buyer satisfies the eligibility predicate without revealing raw documents.

Inputs:
- Private: credential leaf + Merkle path, reserve/risk value, jurisdiction code.
- Public: credential root, predicate threshold, action hash, nullifier.

Outputs: `ProofReceipt { proof, public_inputs, nullifier }`.

State changes: none off-chain; consumed by F003.

Events/logs/evidence: prove time + verify time recorded.

Permissions: any holder of a valid credential leaf.

Idempotency/retry rule: nullifier prevents proof reuse for the same action.

Error cases:
- Invalid input: witness fails to generate.
- Unauthorized: leaf not in tree → proof invalid.
- Duplicate request: nullifier already seen (enforced at F003).
- Dependency timeout: prover error surfaced, no partial proof.
- Partial failure: never emit an unverified proof.

Headless proof command: `npm run prove:settlement` (mock) / live prover script.

Expected proof evidence: valid proof verifies; invalid witness rejected; tampered public input rejected; under-constraint scan clean.

---

> Codex fills F001/F003/F004 contract blocks in the same shape during build.
> No implementation before the relevant block + tests are written.
