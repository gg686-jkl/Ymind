const rateLimitWindow = 60_000;
const rateLimitMax = 20;
const banWindow = 3_600_000;
const maxFailures = 3;

interface RateLimitEntry {
  count: number;
  resetTime: number;
  failures: number;
  banUntil: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  let entry = rateLimitStore.get(clientIP);

  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + rateLimitWindow, failures: 0, banUntil: 0 };
  }

  if (entry.banUntil > now) {
    return false;
  }

  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + rateLimitWindow;
    entry.failures = 0;
  }

  if (entry.count >= rateLimitMax) {
    return false;
  }

  entry.count++;
  rateLimitStore.set(clientIP, entry);
  return true;
}

export function recordFailure(clientIP: string): void {
  const now = Date.now();
  let entry = rateLimitStore.get(clientIP);
  if (!entry) {
    entry = { count: 0, resetTime: now + rateLimitWindow, failures: 0, banUntil: 0 };
  }
  entry.failures++;
  if (entry.failures >= maxFailures) {
    entry.banUntil = now + banWindow;
  }
  rateLimitStore.set(clientIP, entry);
}

export function cleanRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetTime && entry.banUntil === 0) {
      rateLimitStore.delete(key);
    }
  }
}
