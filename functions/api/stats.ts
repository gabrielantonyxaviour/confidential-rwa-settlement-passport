type AnalyticsEventType =
  "wallet_connect" | "proof_generated" | "settled" | "feedback_click";

type StoredAnalyticsEvent = {
  type: AnalyticsEventType;
  address: string | null;
  ts: number;
};

type PublicAnalyticsEvent = Omit<StoredAnalyticsEvent, "ts"> & {
  ts: string;
};

type Counts = Record<AnalyticsEventType, number>;

type AnalyticsKV = {
  get<T>(key: string, options: { type: "json" }): Promise<T | null>;
};

type PagesContext = {
  env: {
    ANALYTICS_KV: AnalyticsKV;
  };
};

export const onRequestGet = async ({
  env,
}: PagesContext): Promise<Response> => {
  const [events, counts, uniqueAddresses] = await Promise.all([
    env.ANALYTICS_KV.get<StoredAnalyticsEvent[]>("events", { type: "json" }),
    env.ANALYTICS_KV.get<Partial<Counts>>("counts", { type: "json" }),
    env.ANALYTICS_KV.get<string[]>("unique_addresses", { type: "json" }),
  ]);

  const storedEvents = Array.isArray(events)
    ? events.filter(isStoredAnalyticsEvent)
    : [];
  const byType = normalizeCounts(counts);
  const recentEvents: PublicAnalyticsEvent[] = storedEvents
    .slice(-20)
    .reverse()
    .map((event) => ({
      type: event.type,
      address: event.address,
      ts: new Date(event.ts).toISOString(),
    }));

  return json({
    totalEvents: storedEvents.length,
    uniqueWallets: Array.isArray(uniqueAddresses)
      ? new Set(uniqueAddresses.filter(isNonEmptyString)).size
      : 0,
    byType,
    recentEvents,
  });
};

function normalizeCounts(value: Partial<Counts> | null): Counts {
  return {
    wallet_connect: numericCount(value?.wallet_connect),
    proof_generated: numericCount(value?.proof_generated),
    settled: numericCount(value?.settled),
    feedback_click: numericCount(value?.feedback_click),
  };
}

function numericCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function isStoredAnalyticsEvent(value: unknown): value is StoredAnalyticsEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const event = value as Partial<StoredAnalyticsEvent>;
  return (
    (event.type === "wallet_connect" ||
      event.type === "proof_generated" ||
      event.type === "settled" ||
      event.type === "feedback_click") &&
    (typeof event.address === "string" || event.address === null) &&
    typeof event.ts === "number" &&
    Number.isFinite(event.ts)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
