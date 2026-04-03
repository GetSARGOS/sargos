import { test, expect } from '@playwright/test'

test.describe('Content Security Policy', () => {
  test('CSP header is present on page responses', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    const csp = response!.headers()['content-security-policy']
    expect(csp).toBeDefined()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("script-src")
    expect(csp).toContain("connect-src")
  })

  test('security headers are present', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    const headers = response!.headers()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })
})
