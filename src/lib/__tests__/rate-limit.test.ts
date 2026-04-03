import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @upstash/redis with a proper class constructor (Vitest 4 requirement)
vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {},
}))

// Mock @upstash/ratelimit with a controllable limit function
const mockLimit = vi.fn()

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit = mockLimit
  }
  // Attach static method — matches Ratelimit.slidingWindow(tokens, window)
  Object.assign(MockRatelimit, {
    slidingWindow: vi.fn().mockReturnValue('sliding-window-config'),
  })
  return { Ratelimit: MockRatelimit }
})

import {
  checkPublicRateLimit,
  checkAuthenticatedRateLimit,
  checkExpensiveRateLimit,
  rateLimitExceededResponse,
  getClientIp,
  _resetForTesting,
} from '../rate-limit'

describe('rate-limit', () => {
  beforeEach(() => {
    _resetForTesting()
    mockLimit.mockReset()
    // Set env vars so limiters are created
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'
  })

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  describe('checkPublicRateLimit', () => {
    it('returns success when under limit', async () => {
      mockLimit.mockResolvedValueOnce({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60000,
      })

      const result = await checkPublicRateLimit('1.2.3.4')
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(9)
      expect(mockLimit).toHaveBeenCalledWith('1.2.3.4')
    })

    it('returns failure when limit exceeded', async () => {
      mockLimit.mockResolvedValueOnce({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 30000,
      })

      const result = await checkPublicRateLimit('1.2.3.4')
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('checkAuthenticatedRateLimit', () => {
    it('calls limit with user ID', async () => {
      mockLimit.mockResolvedValueOnce({
        success: true,
        limit: 60,
        remaining: 59,
        reset: Date.now() + 60000,
      })

      const result = await checkAuthenticatedRateLimit('user-123')
      expect(result.success).toBe(true)
      expect(mockLimit).toHaveBeenCalledWith('user-123')
    })
  })

  describe('checkExpensiveRateLimit', () => {
    it('calls limit with organization ID', async () => {
      mockLimit.mockResolvedValueOnce({
        success: true,
        limit: 20,
        remaining: 19,
        reset: Date.now() + 60000,
      })

      const result = await checkExpensiveRateLimit('org-456')
      expect(result.success).toBe(true)
      expect(mockLimit).toHaveBeenCalledWith('org-456')
    })
  })

  describe('graceful degradation without Upstash credentials', () => {
    it('passes through when UPSTASH_REDIS_REST_URL is not set', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      _resetForTesting()

      const result = await checkPublicRateLimit('1.2.3.4')
      expect(result.success).toBe(true)
      expect(mockLimit).not.toHaveBeenCalled()
    })
  })

  describe('rateLimitExceededResponse', () => {
    it('returns 429 with Retry-After header and standard error shape', async () => {
      const futureReset = Date.now() + 42000
      const response = rateLimitExceededResponse(futureReset)

      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBeDefined()

      const body = await response.json()
      expect(body.data).toBeNull()
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(body.meta.retryAfter).toBeGreaterThanOrEqual(1)
    })

    it('sets Retry-After to at least 1 second', async () => {
      // Reset time is in the past
      const response = rateLimitExceededResponse(Date.now() - 5000)
      expect(response.headers.get('Retry-After')).toBe('1')
    })
  })

  describe('getClientIp', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' },
      })
      expect(getClientIp(request)).toBe('203.0.113.50')
    })

    it('falls back to x-real-ip', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-real-ip': '198.51.100.1' },
      })
      expect(getClientIp(request)).toBe('198.51.100.1')
    })

    it('returns 127.0.0.1 when no IP headers present', () => {
      const request = new Request('https://example.com')
      expect(getClientIp(request)).toBe('127.0.0.1')
    })
  })
})
