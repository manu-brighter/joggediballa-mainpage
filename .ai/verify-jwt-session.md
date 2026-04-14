# Verification: JWT Creation & Session Cookies

## Verdict
PASS WITH NOTES — Analysis is accurate. One significant correction: the JWT secret mismatch is worse than described. Two additional findings.

## Confirmed Correct

- **JWT creation** in `googleAuthRoutes.ts:70-80`: HS256, 7d, payload `{ openId, appId: 'google-oauth', name, email, role }`. Confirmed.
- **`verifySession`** checks `isNonEmptyString(openId)`, `isNonEmptyString(appId)`, `isNonEmptyString(name)` — `sdk.ts:216-219`. All three must be non-empty strings.
- **Empty-name bug**: `googleAuthRoutes.ts:73` uses `user.name || ''`. If Google profile has no display name, `name = ''` fails `isNonEmptyString` in `verifySession`. Login would silently fail — confirmed.
- **`parseCookies`** uses the `cookie` library — `sdk.ts:148-155`. Parses raw `Cookie` header.
- **`authenticateRequest`** extracts COOKIE_NAME, calls `verifySession`, then `getUserByOpenId` — `sdk.ts:259-301`.
- **Manus fallback**: if user not found in DB, calls `getUserInfoWithJwt(sessionCookie)` — `sdk.ts:276`. This calls the Manus OAuth server endpoint `GetUserInfoWithJwt`. For Google OAuth users, the Manus server returns an error → caught → `ForbiddenError('Failed to sync user info')` thrown — `sdk.ts:285-288`.
- **context.ts catches all auth errors** → `user = null` — `context.ts:16-21`. Public procedures unaffected.
- **Cookie options**: `httpOnly: true`, `path: '/'`, `sameSite: 'lax'`, `secure: isSecureRequest(req)` — `cookies.ts:43-48`. `sameSite: 'lax'` is current production value (already changed from `'none'`).
- **Logout**: `clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 })` — confirmed in `routers.ts`.
- **COOKIE_NAME = 'manus-session'** from `shared/const.ts` — used in both signing and verification paths.
- **`verifySession` returns null on missing cookie** — `sdk.ts:203-205`. Confirmed.

## Issues Found

- **JWT secret inconsistency — more severe than analysis states**: The analysis says "JWT_SECRET fallback is a hardcoded string — must be overridden in production." The actual situation is worse:
  - `googleAuthRoutes.ts:8-9`: `JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'`
  - `env.ts:3`: `ENV.cookieSecret = process.env.JWT_SECRET ?? ''` (empty string fallback)
  - `sdk.ts:157-159`: `getSessionSecret()` uses `ENV.cookieSecret`
  - If `JWT_SECRET` is **not set**, Google OAuth creates tokens signed with `'fallback-secret-change-in-production'` but `verifySession` verifies them with `''` (empty string). Verification **always fails** — Google OAuth is completely non-functional without `JWT_SECRET` being set. The analysis presents this only as a security risk; it's also a correctness bug in misconfigured environments.

- **Same empty-name bug exists for Manus tokens**: `sdk.ts:175`: `createSessionToken` passes `name: options.name || ''`. If Manus returns a user with no name, the Manus token also fails `verifySession`. The analysis only flags this for Google OAuth.

## Gaps

- **`upsertUser` called on every authenticated request** (`sdk.ts:295-299`) to update `lastSignedIn`. This is a write DB call on every tRPC request — not mentioned in the analysis. For high-traffic scenarios this is a hot write path.
- **`verifySession` does not set `issuedAt` check** — only validates signature and expiry. A token issued before a password/role change cannot be revoked (stateless). Analysis mentions this but doesn't note there's no `iat` lower-bound check either.

## Unverifiable

- Whether `COOKIE_NAME = 'manus-session'` causes confusion for users inspecting browser cookies — UX concern only.
- Whether 7-day token lifetime is appropriate for this app's security posture.
- Manus OAuth server behavior when called with a Google JWT — confirmed to fail but actual error message is runtime-dependent.

## Security Notes

- **JWT_SECRET misconfiguration = Google OAuth fully broken**, not just "less secure." The differing fallback values in `googleAuthRoutes.ts` vs `env.ts` mean that if `JWT_SECRET` is missing from the `.env` file, no Google user can log in at all. This is a deployment footgun — add a startup check or assert `JWT_SECRET` is set.
- **`lastSignedIn` write on every request**: While not a security issue, it means the DB is written to on every authenticated tRPC request. Consider debouncing or moving to a periodic update.
- **No token revocation**: Stateless JWTs with 7-day TTL. Role changes via the admin panel take effect on the next tRPC request (DB lookup always gets current role from DB), but a stolen token with a valid `openId` can authenticate as that user until expiry.
