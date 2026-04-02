import { test, expect } from '@playwright/test'

test.describe('QR Check-In (public)', () => {
  test('invalid token shows not-found error', async ({ page }) => {
    await page.goto('/check-in/invalid-token-12345')
    await expect(
      page.getByText(/QR Code Not Found|not found|invalid/i),
    ).toBeVisible()
  })

  test('check-in page does not require authentication', async ({ page }) => {
    const response = await page.goto('/check-in/some-test-token')
    // Should not redirect to /login — the page is public
    expect(page.url()).toContain('/check-in/')
    expect(response?.status()).not.toBe(401)
  })
})
