import { describe, it, expect } from 'vitest'
import { getRequestMeta } from '../request-meta'

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com', {
    headers: new Headers(headers),
  })
}

describe('getRequestMeta', () => {
  it('extracts IP from x-forwarded-for (first entry)', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })
    const meta = getRequestMeta(req)
    expect(meta.ipAddress).toBe('1.2.3.4')
  })

  it('extracts IP from x-forwarded-for (single entry)', () => {
    const req = makeRequest({ 'x-forwarded-for': '5.6.7.8' })
    const meta = getRequestMeta(req)
    expect(meta.ipAddress).toBe('5.6.7.8')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '9.10.11.12' })
    const meta = getRequestMeta(req)
    expect(meta.ipAddress).toBe('9.10.11.12')
  })

  it('returns null IP when no IP headers are present', () => {
    const req = makeRequest({})
    const meta = getRequestMeta(req)
    expect(meta.ipAddress).toBeNull()
  })

  it('extracts user-agent header', () => {
    const req = makeRequest({ 'user-agent': 'Mozilla/5.0 TestBrowser' })
    const meta = getRequestMeta(req)
    expect(meta.userAgent).toBe('Mozilla/5.0 TestBrowser')
  })

  it('returns null user-agent when header is absent', () => {
    const req = makeRequest({})
    const meta = getRequestMeta(req)
    expect(meta.userAgent).toBeNull()
  })

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = makeRequest({
      'x-forwarded-for': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
    })
    const meta = getRequestMeta(req)
    expect(meta.ipAddress).toBe('1.1.1.1')
  })
})
