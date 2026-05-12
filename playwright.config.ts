import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config with two projects:
 *
 * - **smoke**: black-box HTTP-level checks (page loads, title is set,
 *   navigation works). Runs against `SMOKE_URL` so the same suite can hit
 *   either localhost (dev) or https://joggediballa.ch (CI smoke job).
 *   No login, no state mutation, no DB seeding required.
 *
 * - **visual**: full-page screenshot regression against a known-good
 *   baseline. Always runs against the local dev server (otherwise live
 *   content drift turns every test red). Baselines committed to git under
 *   `tests/e2e/visual/__screenshots__/`.
 *
 * Usage:
 *   pnpm test:e2e                     # both projects against local dev
 *   pnpm test:e2e:smoke               # smoke only (local)
 *   pnpm test:e2e:smoke:live          # smoke only against live
 *   pnpm test:e2e:visual              # visual only (local)
 *   pnpm test:e2e:update-snapshots    # refresh visual baselines
 */

const SMOKE_URL = process.env.SMOKE_URL ?? 'http://localhost:3000';
const SKIP_WEBSERVER = process.env.PLAYWRIGHT_NO_SERVER === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'smoke',
      testDir: 'tests/e2e/smoke',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: SMOKE_URL,
      },
    },
    {
      name: 'visual',
      testDir: 'tests/e2e/visual',
      use: {
        ...devices['Desktop Chrome'],
        // Visual tests always go to the locally-started dev server.
        baseURL: 'http://localhost:3000',
        viewport: { width: 1280, height: 800 },
      },
      // Reduce flakiness from minor anti-aliasing / sub-pixel differences.
      expect: {
        toHaveScreenshot: {
          maxDiffPixelRatio: 0.01,
          animations: 'disabled',
        },
      },
    },
  ],

  // Auto-start `pnpm dev` for visual tests and for smoke-against-localhost.
  // Skip when running smoke against the live URL (PLAYWRIGHT_NO_SERVER=1).
  webServer: SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 90_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
