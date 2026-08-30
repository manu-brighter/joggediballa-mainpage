import { test, expect } from '@playwright/test';
import { hideVolatileSections, setTheme } from './helpers';

/**
 * One dedicated baseline for the cookie consent banner — captured WITHOUT
 * the localStorage dismissal so we can detect visual regressions on the
 * banner itself (a component that the rest of the visual suite explicitly
 * hides). Single viewport screenshot (above-the-fold) — fullPage is
 * unnecessary, the banner is always pinned at the bottom.
 *
 * These shots are taken on Home, so they need the same volatile-section
 * treatment as the page baselines: a promo button switched on in the admin
 * dashboard would otherwise move the hero and turn these red.
 */
test.beforeEach(async ({ page }) => {
  await hideVolatileSections(page);
});

test.describe('Cookie consent banner', () => {
  test('appears at bottom of page on first visit (light)', async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto('/', { waitUntil: 'networkidle' });
    // The banner mounts after isLoaded flips true (one tick after navigation).
    await expect(page.getByText(/Google Analytics/)).toBeVisible();
    await expect(page).toHaveScreenshot('cookie-banner-light.png');
  });

  test('appears at bottom of page on first visit (dark)', async ({ page }) => {
    await setTheme(page, 'dark');
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Google Analytics/)).toBeVisible();
    await expect(page).toHaveScreenshot('cookie-banner-dark.png');
  });
});
