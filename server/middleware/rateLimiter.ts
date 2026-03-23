import {
  BUSINESS_RATE_LIMIT_WINDOW_MS,
  BUSINESS_RATE_LIMITS,
  businessRateLimitStore,
} from "../config.js";

/**
 * Rate limiter for business endpoints (messages, contacts, campaigns, AI).
 * Limits requests per user per resource per minute.
 */
export const businessRateLimiter =
  (resource: string) => (req: any, res: any, next: any) => {
    const now = Date.now();
    const userId = req.user?.userId || "anon";
    const key = `biz:${resource}:${userId}`;
    const limit = BUSINESS_RATE_LIMITS[resource] || 30;
    const current = businessRateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
      businessRateLimitStore.set(key, {
        count: 1,
        resetAt: now + BUSINESS_RATE_LIMIT_WINDOW_MS,
      });
      return next();
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: `Rate limit exceeded for ${resource}. Please try again later.`,
      });
    }

    current.count += 1;
    businessRateLimitStore.set(key, current);
    next();
  };
