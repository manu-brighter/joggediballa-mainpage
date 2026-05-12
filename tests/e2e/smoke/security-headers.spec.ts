import { test, expect } from '@playwright/test';

/**
 * Smoke-checks the security headers introduced by Phase 3b. Detects a
 * regression where a future helmet/CSP edit accidentally drops a directive.
 */
test('responds with strict security headers', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBeLessThan(400);

  const headers = response.headers();
  expect(headers['content-security-policy']).toBeTruthy();
  expect(headers['strict-transport-security']).toMatch(/max-age=\d+/);
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']?.toLowerCase()).toMatch(/deny|sameorigin/);

  // CSP must NOT allow third-party fonts (we self-host Inter).
  const csp = headers['content-security-policy'] ?? '';
  expect(csp).not.toContain('fonts.googleapis.com');
  expect(csp).not.toContain('fonts.gstatic.com');
});
