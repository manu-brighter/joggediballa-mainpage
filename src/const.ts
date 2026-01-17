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
  // Check if Manus OAuth is configured (both VITE_OAUTH_PORTAL_URL and VITE_APP_ID must be set)
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  
  // Use Manus OAuth only if both variables are properly configured
  const useManusOAuth = oauthPortalUrl && 
                        appId && 
                        oauthPortalUrl !== '' && 
                        appId !== '' &&
                        !oauthPortalUrl.includes('undefined') &&
                        !appId.includes('undefined');
  
  if (useManusOAuth) {
    // Manus OAuth login (for Manus platform)
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  }
  
  // Google OAuth login (default for self-hosting)
  return "/api/auth/google";
};
