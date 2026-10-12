const RATE_WINDOW_SECONDS = 60;

type LimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
};

type MemoryBucket = {
  count: number;
  resetAt: number;
};

declare global {
  var __juzbookRateLimitStore: Map<string, MemoryBucket> | undefined;
}

function getMemoryStore() {
  if (!globalThis.__juzbookRateLimitStore) {
    globalThis.__juzbookRateLimitStore = new Map<string, MemoryBucket>();
  }

  return globalThis.__juzbookRateLimitStore;
}

function getRedisConfig() {
  const url = (process.env.REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    token
  };
}

function readPipelineResult(result: unknown, index: number) {
  if (!Array.isArray(result)) {
    return null;
  }

  const item = result[index];
  if (!item || typeof item !== "object" || !("result" in item)) {
    return null;
  }

  const value = Number((item as { result?: unknown }).result);
  return Number.isFinite(value) ? value : null;
}

async function incrementRedisKey(key: string) {
  const config = getRedisConfig();
  if (!config) {
    return null;
  }

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, RATE_WINDOW_SECONDS]
    ]),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Redis rate limit сұранысы орындалмады.");
  }

  const payload = (await response.json()) as unknown;
  const count = readPipelineResult(payload, 0);

  if (count == null) {
    throw new Error("Redis rate limit жауабы дұрыс емес.");
  }

  return count;
}

function incrementMemoryKey(key: string) {
  const store = getMemoryStore();
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const next = {
      count: 1,
      resetAt: now + RATE_WINDOW_SECONDS * 1000
    };
    store.set(key, next);
    return next;
  }

  const next = {
    count: current.count + 1,
    resetAt: current.resetAt
  };
  store.set(key, next);
  return next;
}

export function getRequestIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "0.0.0.0";
  }

  return request.headers.get("x-real-ip") || "0.0.0.0";
}

export async function enforceAiRateLimit(identity: string, limit = 3): Promise<LimitResult> {
  const minuteBucket = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
  const key = `juzbook:ai:${identity}:${minuteBucket}`;

  try {
    const redisCount = await incrementRedisKey(key);
    if (redisCount != null) {
      return {
        allowed: redisCount <= limit,
        count: redisCount,
        limit,
        retryAfterSeconds: RATE_WINDOW_SECONDS
      };
    }
  } catch (error) {
    console.warn(
      error instanceof Error
        ? `Redis rate limit уақытша істемеді: ${error.message}`
        : "Redis rate limit уақытша істемеді."
    );
  }

  const memoryBucket = incrementMemoryKey(key);
  return {
    allowed: memoryBucket.count <= limit,
    count: memoryBucket.count,
    limit,
    retryAfterSeconds: Math.max(1, Math.ceil((memoryBucket.resetAt - Date.now()) / 1000))
  };
}
