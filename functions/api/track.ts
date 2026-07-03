type AnalyticsEventType =
  "wallet_connect" | "proof_generated" | "settled" | "feedback_click";

type AnalyticsEvent = {
  type: AnalyticsEventType;
  address: string | null;
  ts: number;
};

type Counts = Record<AnalyticsEventType, number>;

type AnalyticsKV = {
  get<T>(key: string, options: { type: "json" }): Promise<T | null>;
  put(key: string, value: string): Promise<void>;
};

type PagesContext = {
  request: Request;
  env: {
    ANALYTICS_KV: AnalyticsKV;
  };
};

const ALLOWED_TYPES = new Set<AnalyticsEventType>([
  "wallet_connect",
  "proof_generated",
  "settled",
  "feedback_click",
]);

export const onRequestPost = async ({
  request,
  env,
}: PagesContext): Promise<Response> => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (
    !isRecord(body) ||
    typeof body.type !== "string" ||
    !isAnalyticsEventType(body.type)
  ) {
    return json({ ok: false, error: "invalid_type" }, 400);
  }

  const address =
    typeof body.address === "string" && body.address.trim()
      ? body.address.trim().slice(0, 128)
      : null;
  const event: AnalyticsEvent = {
    type: body.type,
    address,
    ts: Date.now(),
  };

  const events = await env.ANALYTICS_KV.get<AnalyticsEvent[]>("events", {
    type: "json",
  });
  const nextEvents = [...(Array.isArray(events) ? events : []), event].slice(
    -200,
  );
  await env.ANALYTICS_KV.put("events", JSON.stringify(nextEvents));

  const counts = normalizeCounts(
    await env.ANALYTICS_KV.get<Partial<Counts>>("counts", { type: "json" }),
  );
  counts[event.type] += 1;
  await env.ANALYTICS_KV.put("counts", JSON.stringify(counts));

  if (address) {
    const uniqueAddresses = await env.ANALYTICS_KV.get<string[]>(
      "unique_addresses",
      { type: "json" },
    );
    const nextAddresses = Array.from(
      new Set([
        ...(Array.isArray(uniqueAddresses) ? uniqueAddresses : []),
        address,
      ]),
    ).slice(-200);
    await env.ANALYTICS_KV.put(
      "unique_addresses",
      JSON.stringify(nextAddresses),
    );
  }

  return json({ ok: true });
};

export const onRequest = async (context: PagesContext): Promise<Response> => {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, {
      Allow: "POST",
    });
  }

  return onRequestPost(context);
};

function isAnalyticsEventType(value: string): value is AnalyticsEventType {
  return ALLOWED_TYPES.has(value as AnalyticsEventType);
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}
