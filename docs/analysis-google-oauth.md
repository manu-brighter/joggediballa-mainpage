# Analysis: Google OAuth 2.0 Flow

## Summary
The app supports two OAuth providers: Google OAuth (for self-hosting) and Manus OAuth (legacy, for Manus.ai platform). The active provider is selected at startup based on whether `GOOGLE_CLIENT_ID` is set. Google OAuth uses Passport.js with the `passport-google-oauth20` strategy. After authentication, a JWT is issued and stored in an HTTP-only cookie. All subsequent request authentication goes through the same `sdk.verifySession()` path regardless of which OAuth provider was used.

## Key Files
| File | Role |
|---|---|
| `server/_core/googleAuth.ts` | Passport strategy configuration, user upsert, new-user role assignment, email notification |
| `server/_core/googleAuthRoutes.ts` | Express routes: `/api/auth/google`, `/api/auth/callback/google`, `/api/auth/logout` |
| `server/_core/sdk.ts` | `authenticateRequest()` — JWT verification for every tRPC request |
| `server/_core/context.ts` | Calls `sdk.authenticateRequest()` to build tRPC context per request |
| `server/_core/cookies.ts` | `getSessionCookieOptions()` — cookie security config |
| `shared/const.ts` | `COOKIE_NAME` constant |

## How It Works

### Strategy Setup (`googleAuth.ts`)
- Passport configured with `GoogleStrategy` using `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` env vars.
- If either ID or secret is missing, a warning is logged but startup continues (placeholder values used — strategy is non-functional).
- Default callback URL falls back to `http://localhost:3000/api/auth/callback/google`.
- On successful Google authentication, the strategy callback:
  1. Uses `profile.id` (Google's user ID) as `openId`
  2. Calls `getUserByOpenId(googleId)` to check if user exists
  3. For **new users**: assigns role `visitor` by default, or `admin` if email matches `ADMIN_EMAIL` env var (case-insensitive)
  4. For **existing users**: role field is omitted from upsert — preserving whatever role was set previously
  5. Calls `upsertUser()` with profile data
  6. Logs `registration` or `login` activity via `createActivityLog()`
  7. If new visitor: sends async email notification to `CONTACT_EMAIL_TO`

### Session Middleware (`googleAuthRoutes.ts`)
- `express-session` middleware is registered app-wide (required by Passport internals), but the callback uses `session: false` — sessions are not actually used for state storage.
- `passport.initialize()` and `passport.session()` are mounted app-wide.

### OAuth Routes (`googleAuthRoutes.ts`)
- `GET /api/auth/google` — redirects user to Google's consent screen with `profile` and `email` scopes
- `GET /api/auth/callback/google` — handles redirect back from Google:
  1. `passport.authenticate('google', { failureRedirect: '/login-failed', session: false })`
  2. On success: creates JWT with `SignJWT` (HS256, 7-day expiry)
  3. JWT payload: `{ openId, appId: "google-oauth", name, email, role }`
  4. Sets cookie via `getSessionCookieOptions(req)` + `maxAge: 7 * 24 * 60 * 60 * 1000`
  5. Redirects to `${protocol}://${host}/`
- `GET /api/auth/logout` — clears cookie and redirects to `/`

## Data Flow (browser click → logged-in state)

```
1. User clicks "Login with Google"
2. Browser → GET /api/auth/google
3. Server → 302 redirect to accounts.google.com (with client_id, scope, callback_url)
4. User consents on Google
5. Google → 302 redirect to /api/auth/callback/google?code=...&state=...
6. Passport exchanges code for profile via Google API
7. Strategy callback: upsertUser() in DB, createActivityLog()
8. Server creates JWT (HS256, 7d): { openId, appId: "google-oauth", name, email, role }
9. Server sets HTTP-only cookie (COOKIE_NAME) with JWT value
10. Server → 302 redirect to /
11. Client renders App.tsx → trpc.auth.me.useQuery() fires
12. Server receives request with cookie → sdk.authenticateRequest() verifies JWT
13. Returns User object → useAuth() sets isAuthenticated = true
```

## Edge Cases & Error Handling
- Missing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`: server starts but OAuth is non-functional (logs warning)
- OAuth failure: `passport.authenticate` redirects to `/login-failed` (no such page exists in the app — would render the 404 component)
- User not found after upsert: `done(new Error('Failed to create or fetch user'))` → triggers failure redirect
- Email notification failure: caught and logged, does not block authentication
- Existing user's role is preserved — re-login cannot downgrade or upgrade role

## Security Observations
- `session: false` in the callback is correct — sessions are not used, only JWT cookies
- However, `express-session` middleware is still mounted app-wide (overhead with no functional use)
- JWT secret falls back to `"fallback-secret-change-in-production"` if `JWT_SECRET` env var is missing — critical misconfiguration risk in production
- `GOOGLE_CALLBACK_URL` defaults to `http://` (non-HTTPS) for localhost; must be set correctly in production
- No CSRF protection on the callback route — acceptable since OAuth state parameter handled by Passport
- The `host` for redirect URL is taken from `req.get("host")` without validation — could be manipulated via Host header spoofing if `trust proxy` is misconfigured

## Assumptions
- `ADMIN_EMAIL` is assumed to match exactly one Google account
- Email notification assumes `CONTACT_EMAIL_TO` is configured; falls back to `joggediballa@gmail.com` hardcoded
- No rate limiting on `/api/auth/google` beyond the global 500 req/15min limiter
