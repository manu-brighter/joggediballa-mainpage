export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Generate login URL at runtime
 * 
 * Supports both:
 * - Google OAuth (for self-hosting)
 * - Manus OAuth (for Manus platform)
 * 
 * The system automatically detects which OAuth provider to use based on environment variables.
 */
export const getLoginUrl = () => {
  // Check if we're using Google OAuth (self-hosting)
  const useGoogleOAuth = !import.meta.env.VITE_OAUTH_PORTAL_URL || import.meta.env.VITE_USE_GOOGLE_OAUTH;
  
  if (useGoogleOAuth) {
    // Google OAuth login
    return "/api/auth/google";
  }
  
  // Manus OAuth login (default for Manus platform)
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
