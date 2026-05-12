import { test, expect } from '@playwright/test';
import {
  dismissCookieConsent,
  forceInViewAnimations,
  setTheme,
} from './helpers';

/**
 * Visual regression baselines for mostly-static public pages.
 *
 * Cookie banner is dismissed before navigation (see banner.spec.ts for a
 * dedicated baseline that captures it on purpose).
 * Long pages scroll-trigger their whileInView Framer Motion sections so
 * full-page screenshots include the below-the-fold content.
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

test.beforeEach(async ({ page }) => {
  await dismissCookieConsent(page);
  await forceInViewAnimations(page);
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
