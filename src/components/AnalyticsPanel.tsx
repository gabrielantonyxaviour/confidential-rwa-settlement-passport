import { useEffect, useState } from "react";

type Stats = {
  totalEvents: number;
  uniqueWallets: number;
  byType: {
    wallet_connect: number;
    proof_generated: number;
    settled: number;
    feedback_click: number;
  };
  recentEvents: { type: string; address: string | null; ts: string }[];
};

export function AnalyticsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error("stats request failed");
        const data = (await res.json()) as Stats;
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="analytics-panel">
      <h2>Live Usage</h2>
      {error && <p className="panel-help">Analytics unavailable right now.</p>}
      {!error && !stats && <p className="panel-help">Loading usage stats...</p>}
      {stats && (
        <>
          <div className="analytics-summary">
            <div className="analytics-stat">
              <dt>Wallets seen</dt>
              <dd>{stats.uniqueWallets}</dd>
            </div>
            <div className="analytics-stat">
              <dt>Proofs generated</dt>
              <dd>{stats.byType.proof_generated}</dd>
            </div>
            <div className="analytics-stat">
              <dt>Settlements</dt>
              <dd>{stats.byType.settled}</dd>
            </div>
            <div className="analytics-stat">
              <dt>Feedback clicks</dt>
              <dd>{stats.byType.feedback_click}</dd>
            </div>
          </div>
          {stats.recentEvents.length > 0 && (
            <ul className="analytics-recent">
              {stats.recentEvents.slice(0, 5).map((event, i) => (
                <li key={i}>
                  <span className="analytics-recent-type">{event.type}</span>
                  <span className="analytics-recent-time">
                    {new Date(event.ts).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
