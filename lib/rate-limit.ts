const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>()

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

const cleanupExpiredEntries = () => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore) {
    if (now >= entry.resetAt) rateLimitStore.delete(key)
  }
}

export const rateLimit = (
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult => {
  if (rateLimitStore.size > 1000) {
    cleanupExpiredEntries()
  }

  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count += 1
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}
