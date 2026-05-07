export { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';

/**
 * Login URL for Google OAuth. Earlier versions of this module branched on
 * VITE_OAUTH_PORTAL_URL + VITE_APP_ID to fall back to a Manus.im OAuth
 * portal URL — that flow was removed when we committed to Google as the
 * only auth path (server/_core/oauth.ts + the Manus methods on the sdk
 * singleton are gone). Kept as a function (rather than a constant) so the
 * call-site signature stays compatible with the rest of the app.
 */
export const getLoginUrl = (): string => '/api/auth/google';
