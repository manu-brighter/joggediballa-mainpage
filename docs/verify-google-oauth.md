# Verification: Google OAuth 2.0 Flow

## Verdict
PASS WITH NOTES — Analysis is largely accurate. Two corrections and two gaps identified.

## Confirmed Correct

- **Passport + GoogleStrategy** configured in `server/_core/googleAuth.ts:38-44` with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` env vars. Falls back to `'placeholder'` strings with a logged warning if missing.
- **Default callback URL** is `http://localhost:3000/api/auth/callback/google` — `googleAuth.ts:22-23`. Non-HTTPS default confirmed.
- **New user role assignment**: visitor default, admin if email matches `ADMIN_EMAIL` (case-insensitive) — `googleAuth.ts:68-77`. Existing user role preserved via conditional spread `...(role !== undefined && { role })` — `googleAuth.ts:86`.
- **`session: false`** in passport callback confirmed — `googleAuthRoutes.ts:58`.
- **express-session still mounted** app-wide — `googleAuthRoutes.ts:22-33`. Overhead with no functional use confirmed.
- **JWT payload**: `openId`, `appId: 'google-oauth'`, `name`, `email`, `role` — `googleAuthRoutes.ts:70-76`.
- **JWT algorithm + lifetime**: HS256, 7d — `googleAuthRoutes.ts:77-80`.
- **Cookie set via `getSessionCookieOptions(req)` + `maxAge: 7*24*60*60*1000`** — `googleAuthRoutes.ts:83-87`.
- **Redirect URL uses `req.get("host")`** without sanitization — `googleAuthRoutes.ts:90-93`. Host header spoofing risk confirmed.
- **failureRedirect: '/login-failed'** — `googleAuthRoutes.ts:57`. Route does not exist in app.
- **`sendEmail` async, non-blocking** — `googleAuth.ts:110-146`. Email failure caught and logged.
- **Activity log** (`registration` / `login`) created via `createActivityLog()` — `googleAuth.ts:95-104`.

## Issues Found

- **Analysis claims "scopes defined in strategy config"** — they are defined in BOTH the `GoogleStrategy` constructor (`googleAuth.ts:44`) AND in the route handler (`googleAuthRoutes.ts:45-47`). Redundant but harmless. Not mentioned in analysis.
- **"Debug logs leaking cookie options/request proto" (from plan context)** — not present in current code. Only one `console.log` remains at `googleAuthRoutes.ts:94-96`, logging `user.email` and `user.role` on successful login. This is intentional, not a debug leak.

## Gaps

- **`serializeUser` / `deserializeUser`** are defined in `googleAuth.ts:165-179` even though `session: false` is used. These are never actually called but add noise. The analysis does not mention this.
- **`SESSION_SECRET` fallback**: `googleAuthRoutes.ts:10` uses `JWT_SECRET` as the session secret fallback. The express-session secret is therefore tied to the JWT secret — not a security issue here (session unused) but worth knowing.
- **No state parameter validation**: Passport's `passport-google-oauth20` handles the CSRF `state` parameter internally. This is not mentioned in the analysis but is handled correctly.

## Unverifiable

- Whether `ADMIN_EMAIL` uniquely matches exactly one Google account in production — runtime concern.
- Whether `GOOGLE_CALLBACK_URL` is correctly set in production.
- Rate limiting behavior beyond the global limiter — requires load testing.

## Security Notes

- **Host header spoofing** (`req.get("host")` at `googleAuthRoutes.ts:90`) is the most actionable security gap in this file. If `trust proxy` is misconfigured, an attacker controlling the Host header could redirect OAuth callbacks to a different origin. Mitigation: use `GOOGLE_CALLBACK_URL` env var for redirect construction instead of deriving from the request.
- The `/login-failed` redirect target (`googleAuthRoutes.ts:57, 66, 101`) renders a 404 — the user sees a blank error page. A dedicated error page should be added.
- express-session middleware is mounted unconditionally. Even though sessions aren't used, the overhead (memory allocations per request for session store) is present on every request. Safe to remove the `passport.session()` call and the session middleware when sessions are confirmed unneeded.
