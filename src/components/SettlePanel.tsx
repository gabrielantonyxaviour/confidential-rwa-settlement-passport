import { DEMO_SETTLEMENT_AMOUNT } from "../lib/config";

type SettlePanelProps = {
  canSettle: boolean;
  isSettling: boolean;
  onSettle: () => void;
};

export function SettlePanel({ canSettle, isSettling, onSettle }: SettlePanelProps) {
  return (
    <section className="settle-panel">
      <h2>Settle</h2>
      <p>Demo amount: {DEMO_SETTLEMENT_AMOUNT.toString()}</p>
      <button className="settle-button" type="button" onClick={onSettle} disabled={!canSettle || isSettling}>
        {isSettling ? "Settling..." : "Settle demo asset"}
      </button>
      {!canSettle ? <p className="panel-help">Record an eligibility pass before settling.</p> : null}
    </section>
  );
}
