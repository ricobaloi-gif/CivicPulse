import { adminDb } from "./apiAuth";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
};

const STRICT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
};

const WRITE_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
};

interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
}

const memoryStore = new Map<string, { count: number; windowStart: number }>();

function getConfigForEndpoint(path: string, method: string): RateLimitConfig {
  if (method === "GET") {
    if (path.includes("/analytics")) return STRICT_CONFIG;
    return DEFAULT_CONFIG;
  }
  return WRITE_CONFIG;
}

function getMemoryRateLimit(key: string, config: RateLimitConfig): RateLimitInfo {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now - entry.windowStart >= config.windowMs) {
    memoryStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
      totalRequests: 1,
    };
  }

  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed: entry.count <= config.maxRequests,
    remaining,
    resetTime: entry.windowStart + config.windowMs,
    totalRequests: entry.count,
  };
}

async function getFirestoreRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitInfo> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    const rateLimitRef = adminDb.collection("rateLimits").doc(key);
    const doc = await rateLimitRef.get();

    if (!doc.exists) {
      await rateLimitRef.set({
        count: 1,
        windowStart: now,
        createdAt: new Date(),
      });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
        totalRequests: 1,
      };
    }

    const data = doc.data()!;
    let count = data.count || 0;
    let storedWindowStart = data.windowStart?.toMillis?.() || data.windowStart || 0;

    if (now - storedWindowStart >= config.windowMs) {
      count = 1;
      storedWindowStart = now;
    } else {
      count++;
    }

    const remaining = Math.max(0, config.maxRequests - count);

    await rateLimitRef.update({
      count,
      windowStart: storedWindowStart,
      updatedAt: new Date(),
    });

    return {
      allowed: count <= config.maxRequests,
      remaining,
      resetTime: storedWindowStart + config.windowMs,
      totalRequests: count,
    };
  } catch (err) {
    console.error("Firestore rate limit error, falling back to memory:", err);
    return getMemoryRateLimit(key, config);
  }
}

export async function checkRateLimit(
  apiKeyId: string,
  path: string,
  method: string,
  useFirestore = false
): Promise<RateLimitInfo> {
  const config = getConfigForEndpoint(path, method);
  const key = `ratelimit:${apiKeyId}:${path}:${method}`;

  if (useFirestore) {
    return getFirestoreRateLimit(key, config);
  }

  return getMemoryRateLimit(key, config);
}

export function addRateLimitHeaders(response: Response, info: RateLimitInfo): Response {
  const headers = new Headers(response.headers);
  headers.set("X-RateLimit-Limit", String(DEFAULT_CONFIG.maxRequests));
  headers.set("X-RateLimit-Remaining", String(info.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(info.resetTime / 1000)));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createRateLimitedResponse(info: RateLimitInfo): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Rate limit exceeded. Please slow down your requests.",
        details: {
          retryAfter: Math.ceil((info.resetTime - Date.now()) / 1000),
        },
      },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(DEFAULT_CONFIG.maxRequests),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(info.resetTime / 1000)),
        "Retry-After": String(Math.ceil((info.resetTime - Date.now()) / 1000)),
      },
    }
  );
}