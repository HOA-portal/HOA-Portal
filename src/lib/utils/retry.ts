const RETRYABLE_STATUSES = new Set([429, 500, 503])

function isRetryable(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const status = (err as { status?: number }).status
    if (status !== undefined) return RETRYABLE_STATUSES.has(status)
    const message = String((err as { message?: string }).message ?? '')
    if (/timeout|ETIMEDOUT|ECONNRESET/i.test(message)) return true
  }
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isRetryable(err) || attempt === maxAttempts - 1) throw err
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)))
    }
  }
  throw lastError
}
