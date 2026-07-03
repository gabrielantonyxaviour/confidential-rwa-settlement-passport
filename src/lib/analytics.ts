export type AnalyticsEventType =
  "wallet_connect" | "proof_generated" | "settled" | "feedback_click";

export function trackEvent(type: AnalyticsEventType, address?: string): void {
  fetch("/api/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type, address }),
  }).catch(() => {});
}
