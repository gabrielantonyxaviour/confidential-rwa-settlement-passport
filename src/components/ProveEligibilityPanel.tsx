import { DEMO_RESERVE_VALUE, DEMO_THRESHOLD } from "../lib/config";
import type { SettlementProofResult } from "../lib/proof";
import { shortHex } from "../lib/bytes";

type ProveEligibilityPanelProps = {
  address: string | null;
  isGenerating: boolean;
  isRecording: boolean;
  proof: SettlementProofResult | null;
  onProveAndRecord: () => void;
};

export function ProveEligibilityPanel({
  address,
  isGenerating,
  isRecording,
  proof,
  onProveAndRecord,
}: ProveEligibilityPanelProps) {
  const isBusy = isGenerating || isRecording;

  return (
    <section className="prove-eligibility-panel">
      <h2>Prove Eligibility</h2>
      <p className="proof-demo-note">
        Demo credential fixed at reserve {DEMO_RESERVE_VALUE}; private witness values are not sent on-chain.
      </p>
      <dl className="proof-public-summary">
        <div className="proof-public-summary-item">
          <dt>Threshold</dt>
          <dd>{DEMO_THRESHOLD}</dd>
        </div>
        <div className="proof-public-summary-item">
          <dt>Credential root</dt>
          <dd>{proof ? shortHex(proof.credentialRoot) : "Not proven yet"}</dd>
        </div>
        <div className="proof-public-summary-item">
          <dt>Nullifier</dt>
          <dd>{proof ? shortHex(proof.nullifier) : "Not proven yet"}</dd>
        </div>
      </dl>
      <button
        className="prove-eligibility-button"
        type="button"
        onClick={onProveAndRecord}
        disabled={!address || isBusy}
      >
        {isGenerating ? "Generating proof..." : isRecording ? "Recording pass..." : "Generate proof and record pass"}
      </button>
      {!address ? <p className="panel-help">Connect Freighter before proving eligibility.</p> : null}
    </section>
  );
}
