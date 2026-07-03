# Resource Preflight

Project: Confidential RWA Settlement Passport
Now building for: RiseIn "Stellar Journey to Mastery" Level 4 (Green Belt) — production MVP on Stellar testnet.
Date updated: 2026-07-03

## Status: READY (verifier spike passed for real, on testnet)

The 2026-07-01 blockers below were specific to a different, more restricted sandbox
environment (no network DNS, no macOS keychain access, no `bb`/`snarkjs`). None of
that applies here. In this environment: `stellar network health --network testnet`
reports Healthy, friendbot funding works, and the full ZK toolchain is installed:
`nargo` 1.0.0-beta.18, `bb` (Barretenberg) 3.0.0-nightly (installed via `bbup`,
lives at `~/.bb/bb`), `snarkjs`, `circom`.

## Verifier Spike — PASSED (acceptable fallback, honestly labeled)

Pattern used: **off-chain proof verification, on-chain settlement receipt.** This
is the fallback path this doc originally flagged as acceptable, not full on-chain
SNARK verification (Soroban has no native UltraHonk verifier precompile as of this
build). It is real: a real proof is generated and verified with `bb`, and a real
Soroban contract state change (a settlement-pass receipt, then a gated asset
transfer) only happens once that verification has occurred.

### Circuit (real Pedersen hash, not toy arithmetic)

`circuits/settlement_passport/src/main.nr` proves: Merkle membership (2-level
tree, `std::hash::pedersen_hash`) + a reserve/threshold check + a nullifier
derived via `pedersen_hash(leaf, action_hash)`.

```
cd circuits/settlement_passport
nargo test
# [settlement_passport] 4 tests passed
```

### Real proof generation + verification

```
nargo compile
nargo execute valid_witness          # produces target/valid_witness.gz
bb write_vk -b target/settlement_passport.json -o target/proof_valid
bb prove -b target/settlement_passport.json -w target/valid_witness.gz \
  -k target/proof_valid/vk -o target/proof_valid
bb verify -p target/proof_valid/proof -k target/proof_valid/vk \
  -i target/proof_valid/public_inputs
# Proof verified successfully
```

Negative case: an under-threshold witness fails to even generate ("Cannot
satisfy constraint") — a real prover cannot produce a valid proof for a false
statement.

### Contracts, deployed and wired on Stellar testnet

| Contract | ID | Deploy tx |
|---|---|---|
| `receipt_gate` | `CCAJ3DGKJB2TKWM7BXG6I7W3NDSZD6C4EH5EADAIO6NNDL2RSU6FR3NT` | `52153dd7b6efb8c06533e21fa22f2e787634a7de288a5a4ab6f0c36993ee64a3` |
| `settlement` | `CDCXKGH6CKO62DPVOAZZT3SY5VWCEV2YGZTKYMTS4ZKIG7J3BSULJC7U` | `f92e13a5b8214ad5eeb6197c785e87199a525e390a6b178d264f622631a8c1b9` |

`trusted_verifier_hash` = sha256 of the real `bb write_vk` output
(`3c56f0f9c4b5c720ebc0bb3c3a72a24137d0d612a32b7f14144616d73652957b`) — this
represents "the caller ran the correct, fixed verifying key and it accepted."

### Real end-to-end demo on testnet (all four calls below are real transactions/simulations against the deployed contracts)

1. `record_pass` on `receipt_gate` (the on-chain step gated by the off-chain-verified proof) — tx `a80091aaa282817b4bebe8fc12eab59cda85dd4e7dd5c4dbc59e621feb99cd93`, succeeded.
2. `settle` on `settlement` for that nullifier/action — tx `5d4719314ca1cd343d711144f640a89ad3c7642a74cba3b8ecc60b7c08540378`, succeeded. Buyer balance confirmed at 100 via a direct `balance` read.
3. `settle` for an action_id with **no** recorded receipt — rejected with `Error(Contract, #4)` (`ReceiptNotVerified`), propagated from `receipt_gate`'s `get_receipt_for_action` returning `ReceiptNotFound` through the real inter-contract call.
4. `settle` **replaying** the already-used nullifier — rejected with `Error(Contract, #3)` (`AlreadySettled`).

## Gate

Preflight status: `ready`. The verifier spike is real and reproducible; both
contracts are live on testnet with a genuine gated inter-contract settlement flow.

Remaining for Level 4: frontend (wallet connect, proof-generation flow in the
browser or a small local prover step, settlement UI, mobile responsive, loading/
error states), real user onboarding (10 users, feedback collection), monitoring.
