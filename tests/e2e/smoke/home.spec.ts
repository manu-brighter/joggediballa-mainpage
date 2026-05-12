import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('loads and sets correct title', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/Jogge di Balla/);
  });

  test('renders main navigation', async ({ page }) => {
    await page.goto('/');
    // Header nav is always rendered; check at least one nav link works.
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('has self-hosted Inter font (no Google Fonts request)', async ({
    page,
  }) => {
    // Asserts the revDSG cleanup: no third-party font requests leak user IPs.
    const googleFontsRequests: string[] = [];
    page.on('request', req => {
      const url = req.url();
      if (
        url.includes('fonts.googleapis.com') ||
        url.includes('fonts.gstatic.com')
      ) {
        googleFontsRequests.push(url);
      }
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(googleFontsRequests, googleFontsRequests.join('\n')).toEqual([]);
  });
});
