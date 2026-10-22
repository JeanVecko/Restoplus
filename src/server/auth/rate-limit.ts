const WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; expiresAt: number }>();

export function allowReactivationAttempt(
  key: string,
  now = Date.now(),
): boolean {
  // En production, la limite stricte de 5 tentatives / 15 min s'applique sans dérogation possible.
  const isProduction = process.env.NODE_ENV === "production";
  const maxAttempts = isProduction
    ? DEFAULT_MAX_ATTEMPTS
    : process.env.AUTH_RATE_LIMIT_MAX
      ? Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10)
      : 100;

  if (attempts.size > 5_000) {
    for (const [entryKey, entry] of attempts) {
      if (entry.expiresAt <= now) attempts.delete(entryKey);
    }
    if (attempts.size > 5_000) attempts.clear();
  }
  const current = attempts.get(key);
  if (!current || current.expiresAt <= now) {
    attempts.set(key, { count: 1, expiresAt: now + WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= maxAttempts;
}

export function resetRateLimits(): void {
  attempts.clear();
}
