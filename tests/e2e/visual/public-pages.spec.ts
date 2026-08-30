import { test, expect } from '@playwright/test';
import {
  dismissCookieConsent,
  forceInViewAnimations,
  hideVolatileSections,
  setTheme,
} from './helpers';

/**
 * Visual regression baselines for mostly-static public pages.
 *
 * Cookie banner is dismissed before navigation (see banner.spec.ts for a
 * dedicated baseline that captures it on purpose).
 *
 * Excluded entirely (DB-dependent): /events with photos, /team with members,
 * /sponsors with logos, admin pages. Add after we have stable test fixtures.
 *
 * Home is in the list but is *partly* DB-dependent — its "next event" block
 * appears and disappears with the calendar. That block is marked
 * `data-visual-volatile` and hidden by `hideVolatileSections`, so the rest of
 * the page stays covered without the baseline expiring on its own.
 */

const STABLE_PUBLIC_ROUTES: Array<{ name: string; path: string }> = [
  { name: 'home', path: '/' },
  { name: 'contact', path: '/contact' },
  { name: 'impressum', path: '/impressum' },
  { name: 'datenschutz', path: '/datenschutz' },
  { name: 'dienstleistungen', path: '/dienstleistungen' },
  { name: 'not-found', path: '/this-route-does-not-exist' },
];

test.beforeEach(async ({ page }) => {
  await dismissCookieConsent(page);
  await forceInViewAnimations(page);
  await hideVolatileSections(page);
});

for (const { name, path } of STABLE_PUBLIC_ROUTES) {
  test(`${name} page matches baseline`, async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto(path, { waitUntil: 'networkidle' });
    // Tiny settle wait so Framer Motion writes its final styles to the DOM.
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
    });
  });

  test(`${name} page (dark mode) matches baseline`, async ({ page }) => {
    await setTheme(page, 'dark');
    await page.goto(path, { waitUntil: 'networkidle' });
    // Tiny settle wait so Framer Motion writes its final styles to the DOM.
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot(`${name}-dark.png`, {
      fullPage: true,
    });
  });
}
