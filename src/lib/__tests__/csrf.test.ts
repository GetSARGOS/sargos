import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateOrigin, csrfRejectedResponse } from '../csrf'

describe('csrf', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.sargos.com')
    vi.stubEnv('NODE_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('validateOrigin', () => {
    it('allows requests with no Origin or Referer (non-browser clients)', () => {
      const request = new Request('https://app.sargos.com/api/check-in/abc', {
        method: 'POST',
      })
      expect(validateOrigin(request)).toBe(true)
    })

    it('allows requests with matching Origin header', () => {
      const request = new Request('https://app.sargos.com/api/check-in/abc', {
        method: 'POST',
        headers: { origin: 'https://app.sargos.com' },
      })
      expect(validateOrigin(request)).toBe(true)
    })

    it('rejects requests with mismatched Origin header', () => {
      const request = new Request('https://app.sargos.com/api/check-in/abc', {
        method: 'POST',
        headers: { origin: 'https://evil.com' },
      })
      expect(validateOrigin(request)).toBe(false)
    })

    it('allows requests when Origin matches via Referer fallback', () => {
      const request = new Request('https://app.sargos.com/api/check-in/abc', {
        method: 'POST',
        headers: { referer: 'https://app.sargos.com/check-in/some-token' },
      })
      expect(validateOrigin(request)).toBe(true)
    })

    it('rejects requests with mismatched Referer', () => {
      const request = new Request('https://app.sargos.com/api/check-in/abc', {
        method: 'POST',
        headers: { referer: 'https://evil.com/attack-page' },
      })
      expect(validateOrigin(request)).toBe(false)
    })

    it('allows localhost in development mode', () => {
      vi.stubEnv('NODE_ENV', 'development')
      const request = new Request('http://localhost:3000/api/check-in/abc', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
      })
      expect(validateOrigin(request)).toBe(true)
    })

    it('rejects localhost in production mode', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.sargos.com')
      const request = new Request('https://app.sargos.com/api/check-in/abc', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
      })
      expect(validateOrigin(request)).toBe(false)
    })
  })

  describe('csrfRejectedResponse', () => {
    it('returns 403 with standard error shape', async () => {
      const response = csrfRejectedResponse()
      expect(response.status).toBe(403)

      const body = await response.json()
      expect(body.data).toBeNull()
      expect(body.error.code).toBe('CSRF_ORIGIN_MISMATCH')
      expect(body.error.message).toBe('Forbidden')
    })
  })
})
