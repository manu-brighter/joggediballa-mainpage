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
 * Hides every element marked `data-visual-volatile` before the first paint.
 *
 * Some blocks render from live data and change on their own: the Home hero's
 * "next event" section only exists while an event is still in the future, so
 * a baseline captured today silently rots once that date passes. Masking is
 * not enough — the section's *height* disappears with it, which moves
 * everything below. Hiding it outright keeps the page height stable whether
 * or not the data is there, and the rest of the page stays covered.
 *
 * Call this BEFORE `page.goto()`.
 */
export async function hideVolatileSections(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const inject = () => {
      const style = document.createElement('style');
      style.textContent = '[data-visual-volatile]{display:none !important}';
      document.head.appendChild(style);
    };
    if (document.head) inject();
    else document.addEventListener('DOMContentLoaded', inject, { once: true });
  });
}

/**
 * Patches `window.IntersectionObserver` so every observed element fires as
 * `isIntersecting: true` on its first observe() call.
 *
 * Originally added for Framer Motion's `whileInView` driver; those reveals
 * are gone, but the shim still earns its place: `LazyImage` and
 * `SmartCoverImage` load via IntersectionObserver, and Playwright's internal
 * scroll is too fast to give the real observer a paint frame. Without it,
 * below-the-fold images stay blank in fullPage screenshots.
 *
 * Call this BEFORE `page.goto()`.
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
    window.IntersectionObserver =
      ImmediateIO as unknown as typeof IntersectionObserver;
  });
}
