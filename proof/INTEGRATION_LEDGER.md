# Integration Ledger

Project: Confidential RWA Settlement Passport
Hackathon: Stellar Hacks: Real-World ZK (`stellar-zk-hackathon`)
Date: 2026-07-01

## Rule

UI integration happens only after the target feature contract is proven headless.
Do not debug the full app at once. Integrate one risky seam at a time or batches
of 3-5 low-risk seams. UI is the final shell over already-working logic.

## Integration Batches

| Batch | UI surface/component | Proven feature contract | Adapter path | Risk | Evidence required | Status |
|---|---|---|---|---|---|---|
| B001 | Settlement panel (eligible vs ineligible) | F003 + F004 | mock → live | high | verifier pass receipt, replay rejected, transfer gated | pending |
| B002 | Proof status / receipt viewer | F002 + F003 | mock → live | medium | masked private fields, prove/verify timing | pending |
| B003 | Credential issuance (demo fixture) | F001 | mock | low | root stable, dup rejected | pending |

## Evidence Log

| Date | Batch | What was connected | Test command/evidence | Result | Notes |
|---|---|---|---|---|---|
| 2026-07-01 | B001 | Local verifier-receipt scaffold only: Noir predicate circuit + Soroban receipt-gate contract skeleton | `HOME="$PWD/.home" XDG_CACHE_HOME="$PWD/.home/.cache" nargo test` in `circuits/settlement_passport` | partial: local Noir tests pass 4/4; no testnet tx | Not a completed verifier spike. Testnet/Friendbot DNS, Stellar CLI cert/keychain access, missing `bb`/`snarkjs`, and uncached `soroban-sdk` block prove->verify->state-write evidence. |
| 2026-07-03 | B001 | Full verifier spike, real environment: circuit swapped to real `pedersen_hash`, real `bb prove`/`bb verify` round-trip, `receipt_gate` + `settlement` contracts deployed to testnet and wired together | `bb verify` → "Proof verified successfully"; `record_pass` tx `a80091aaa282817b4bebe8fc12eab59cda85dd4e7dd5c4dbc59e621feb99cd93`; `settle` success tx `5d4719314ca1cd343d711144f640a89ad3c7642a74cba3b8ecc60b7c08540378`; `settle` blocked (no receipt) → `Error(Contract, #4)`; `settle` blocked (replay) → `Error(Contract, #3)` | **done** | Genuine on-chain gated settlement via real inter-contract call (`settlement` → `receipt_gate.get_receipt_for_action`). Both directions (eligible settles, ineligible/replay blocked) proven on testnet, not simulated locally. |
| 2026-07-03 | B001/B002 | **Live-browser verification of the actual deployed UI** (`localhost:5186`, real Freighter connection, real `@noir-lang/noir_js` + `@aztec/bb.js` client-side proof generation — not CLI/scripted): connected wallet `GBL32C...4OYHJ3`, clicked "Generate proof and record pass" — the app genuinely computed a real credential_root/nullifier client-side in the browser. Clicked "Settle demo asset" after. | UI correctly rendered: `Eligibility Pass ✗ This nullifier already has a settlement-pass receipt for the demo action.` and `Settlement ✗ This nullifier/action pair has already been settled.` — both are REAL reads against the live `receipt_gate`/`settlement` contracts (not fabricated UI copy), confirming this exact wallet+demo-credential pair is the same one already consumed by the 2026-07-03 CLI spike above. Recording: `demo-recordings/prove-eligibility-and-settle-replay-guard.gif`. | **done (boundary path)** | **Important operational finding, not a bug:** `deriveSettlementAction()` derives the action/nullifier as `SHA256(connectedWalletAddress)`, so with the fixed `DEMO_CREDENTIAL_INPUTS`, **each wallet address can only successfully complete the eligible-settles path ONCE, ever** (that's the nullifier working correctly). The demo wallet used here already burned its one-time success on the earlier CLI spike. **Before the final demo recording, either (a) connect a fresh, never-used Freighter account to get a genuinely fresh nullifier for a clean success recording, or (b) redeploy `receipt_gate`+`settlement` fresh right before recording.** The React proof-generation UI itself (masked private fields, real prove/verify timing, real client-side WASM proving) is confirmed working — B002's core requirement — this is purely about getting one clean take of the success path before final capture. |

| 2026-07-03 | B001/B002 | **Root-cause fix for the one-time-use nullifier finding above.** `action_hash`/`action_id` are no longer a single global constant — `src/lib/action.ts` now derives a per-wallet action (via a Pedersen-hash-compatible reduction of the address, confirmed to match Noir's `std::hash::pedersen_hash` by reproducing the known `(leaf=11, action_hash=44)` vector) so every distinct wallet address gets its own nullifier, not just the first one to try. | Two proof-smoke test addresses produced two different nullifiers (`GAAA...WHF` → `108efab8...789be07686`, `GBL32C...AONE` → `0863f440...36e576b7d5d25`); re-ran the full browser flow with the live demo wallet post-fix: fresh nullifier `2f4ffc76...e0c1bf5e`, `record_pass` succeeded, `settle` succeeded, balance confirmed at 100. | **done** | This supersedes the "connect a fresh wallet each time" workaround noted above — that was a demo-recording workaround, not a fix. Real users can now each complete the flow once, independently, which is required for RiseIn Level 4's 10-real-user requirement. |

## Final Demo Proof Checklist

- [x] Verifier spike green (on-chain verification OR honestly-labeled receipt fallback). — done 2026-07-03, both CLI and live-browser confirmed.
- [x] Core proof command passes (valid verifies, invalid/tampered/replay rejected). — done, both directions confirmed on-chain.
- [ ] Contract/schema tests pass (F001–F004). — F001 (credential issuance UI) still not connected per B003.
- [x] Two-action demo runs end-to-end on testnet: ineligible blocked → eligible settles. — the "eligible settles" half needs a FRESH wallet/redeploy for a clean recorded take (current demo wallet's nullifier is already spent — see note above); the "blocked" half is fully proven and recorded.
- [ ] UI-connected batches pass. — B001 done, B002 done (boundary path; success path needs the fresh-wallet fix above), B003 still pending (credential issuance UI not yet wired).
- [ ] Public repo + README (with ZK explanation) present.
- [ ] 2-3 min demo video produced after /discuss-demo brief.
- [ ] Demo artifacts saved: receipts, traces, proofs, logs, screenshots, links. — partial: tx hashes + one UI recording saved in `demo-recordings/`; still need a clean success-path recording once the wallet/redeploy fix above is applied.
