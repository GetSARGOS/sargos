import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry } from '../retry'

// Use tiny delays (1ms base) so tests run fast with real timers
const FAST = { baseDelayMs: 1 }

describe('withRetry', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('returns the result on first success without delay', async () => {
    const fn = vi.fn().mockResolvedValue('ok')

    const result = await withRetry(fn, FAST)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('retries on failure and returns eventual success', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, FAST)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws the last error after all attempts exhausted', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockRejectedValueOnce(new Error('fail-3'))

    await expect(withRetry(fn, FAST)).rejects.toThrow('fail-3')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('respects custom maxAttempts', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))

    await expect(
      withRetry(fn, { maxAttempts: 2, baseDelayMs: 1 }),
    ).rejects.toThrow('fail-2')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('respects custom baseDelayMs', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, { baseDelayMs: 1 })

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('logs a warning on each retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    await withRetry(fn, FAST)

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('attempt 1/3 failed'),
    )
  })

  it('does not retry when maxAttempts is 1', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail'))

    await expect(
      withRetry(fn, { maxAttempts: 1, baseDelayMs: 1 }),
    ).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('uses defaults when no options provided (3 attempts)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, FAST)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(warnSpy).toHaveBeenCalledTimes(2)
  })
})
