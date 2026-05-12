import { test, expect } from '@playwright/test';

/**
 * Visual regression baselines for mostly-static public pages.
 *
 * On the first run, `pnpm test:e2e:update-snapshots` captures the baseline
 * into `__screenshots__/`. Subsequent runs diff against the baseline and
 * fail when pixels drift outside the maxDiffPixelRatio tolerance.
 *
 * Excluded for now (DB-dependent): /events with photos, /team with members,
 * /sponsors with logos, admin pages. Add after we have stable test fixtures.
 */

const STABLE_PUBLIC_ROUTES: Array<{ name: string; path: string }> = [
  { name: 'home', path: '/' },
  { name: 'contact', path: '/contact' },
  { name: 'impressum', path: '/impressum' },
  { name: 'datenschutz', path: '/datenschutz' },
  { name: 'dienstleistungen', path: '/dienstleistungen' },
  { name: 'not-found', path: '/this-route-does-not-exist' },
];

for (const { name, path } of STABLE_PUBLIC_ROUTES) {
  test(`${name} page matches baseline`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });
    // Allow any framer-motion intro animations to settle (config disables them,
    // but belt-and-braces).
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
    });
  });

  test(`${name} page (dark mode) matches baseline`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot(`${name}-dark.png`, {
      fullPage: true,
    });
  });
}
