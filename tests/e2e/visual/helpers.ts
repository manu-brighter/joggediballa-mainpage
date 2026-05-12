import type { Page } from '@playwright/test';

/**
 * Sets the cookie-consent localStorage entry BEFORE the page navigates, so
 * the CookieConsentBanner does not appear. Call this in `test.beforeEach`
 * for visual tests that should not be obstructed by the banner.
 *
 * Storage key + version must stay in sync with
 * client/src/_core/hooks/useCookieConsent.ts.
 */
export async function dismissCookieConsent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'joggediballa_cookie_consent',
      JSON.stringify({
        version: '1.0',
        consent: { analytics: true, marketing: true, functional: true },
        timestamp: new Date().toISOString(),
      }),
    );
  });
}

/**
 * Explicitly set the user's theme preference before navigation. Visual tests
 * must pin this because the app default is now 'dark' — emulating
 * prefers-color-scheme alone no longer switches the theme (the inline script
 * in index.html prefers localStorage over the system query).
 *
 * Storage key must stay in sync with client/src/contexts/ThemeContext.tsx.
 */
export async function setTheme(
  page: Page,
  theme: 'light' | 'dark' | 'system',
): Promise<void> {
  await page.addInitScript(t => {
    localStorage.setItem('theme', t);
  }, theme);
}

/**
 * Patches `window.IntersectionObserver` so every observed element fires as
 * `isIntersecting: true` on its first observe() call. Framer Motion's
 * `whileInView` driver listens via IntersectionObserver — without this
 * shim, sections below the fold stay at their `initial` opacity-0 state
 * in fullPage screenshots (Playwright's internal scroll is too fast to
 * give the real observer a paint frame to fire).
 *
 * Side-effect: any lazy <img> using IntersectionObserver also "intersects"
 * immediately, which is what we want — baselines should include images.
 *
 * Call this BEFORE `page.goto()`. Use via `dismissCookieConsent` next to
 * `forceInViewAnimations` in `beforeEach`.
 */
export async function forceInViewAnimations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const OriginalIO = window.IntersectionObserver;
    if (!OriginalIO) return;
    class ImmediateIO extends OriginalIO {
      private __cb: IntersectionObserverCallback;
      constructor(
        cb: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        super(cb, options);
        this.__cb = cb;
      }
      override observe(target: Element): void {
        super.observe(target);
        const rect = target.getBoundingClientRect();
        const entry = {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: rect,
          intersectionRect: rect,
          rootBounds: null,
          time: performance.now(),
        } as IntersectionObserverEntry;
        this.__cb([entry], this as unknown as IntersectionObserver);
      }
    }
    window.IntersectionObserver = ImmediateIO as unknown as typeof IntersectionObserver;
  });
}
