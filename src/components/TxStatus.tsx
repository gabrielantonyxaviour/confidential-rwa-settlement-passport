import { stellarExpertTxUrl } from "../lib/config";

export type TxStatusState =
  | { type: "idle" }
  | { type: "pending"; message: string }
  | { type: "success"; message: string; hash?: string }
  | { type: "error"; message: string };

type TxStatusProps = {
  title: string;
  status: TxStatusState;
};

export function TxStatus({ title, status }: TxStatusProps) {
  if (status.type === "idle") {
    return null;
  }

  return (
    <section className={`tx-status tx-status-${status.type}`} aria-live="polite">
      <h3>{title}</h3>
      <p>{status.message}</p>
      {status.type === "success" && status.hash ? (
        <a href={stellarExpertTxUrl(status.hash)} target="_blank" rel="noreferrer">
          View transaction on Stellar Expert
        </a>
      ) : null}
    </section>
  );
}
