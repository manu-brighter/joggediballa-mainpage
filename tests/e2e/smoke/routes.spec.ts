import { test, expect } from '@playwright/test';

/**
 * Static-route smoke tests — assert every public route 200s and renders the
 * SPA shell. Does not exercise content (DB-dependent), only that the route
 * exists, returns successfully, and React mounts.
 */
const STATIC_ROUTES = [
  '/events',
  '/team',
  '/sponsors',
  '/contact',
  '/goennermitglieder',
  '/dienstleistungen',
  '/impressum',
  '/datenschutz',
  '/harassenlauf',
  '/shotcounter',
];

for (const path of STATIC_ROUTES) {
  test(`route ${path} returns HTTP 2xx and mounts the app shell`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status(), `${path} returned ${response?.status()}`).toBeLessThan(400);
    // SPA shell — Vite injects #root or similar; the title gets set via React
    await expect(page.locator('#root')).toBeAttached();
  });
}

test('404 page is rendered for unknown routes', async ({ page }) => {
  await page.goto('/definitely-not-a-real-route');
  // Unknown routes fall through to Wouter's catch-all <Route component={NotFound} />,
  // which renders client-side without changing the HTTP status. Assert on the
  // visible NotFound copy to confirm React mounted and matched the fallback route.
  await expect(page.getByText(/Diese Seite gibt.s nicht/i)).toBeVisible();
});
