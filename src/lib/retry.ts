// Exponential backoff retry wrapper for unreliable network operations.
// Apply only to critical mutation paths that run under field conditions
// (intermittent connectivity). Do NOT apply to read queries.

interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number
  /** Base delay in milliseconds before exponential growth. Default: 200 */
  baseDelayMs?: number
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 200

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt < maxAttempts) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
        console.warn(
          `[withRetry] attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms`,
        )
        await sleep(delayMs)
      }
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
