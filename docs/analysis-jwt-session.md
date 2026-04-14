# Analysis: JWT Creation & Session Cookies

## Summary
JWT tokens are created in `googleAuthRoutes.ts` after OAuth success and verified on every request via `sdk.authenticateRequest()` in `server/_core/sdk.ts`. The same `SDKServer.verifySession()` method handles both Manus-issued and Google-issued JWTs because both use the same signing secret (`JWT_SECRET` / `cookieSecret`). The verified session is then used to look up the full `User` record from the database to populate the tRPC context.

## Key Files
| File | Role |
|---|---|
| `server/_core/googleAuthRoutes.ts` | JWT creation (Google OAuth path) |
| `server/_core/sdk.ts` | `verifySession()`, `authenticateRequest()` — unified JWT verification |
| `server/_core/context.ts` | Calls `sdk.authenticateRequest()` per tRPC request |
| `server/_core/cookies.ts` | Cookie security options |
| `server/routers.ts` | `auth.logout` mutation (cookie clearing) |
| `shared/const.ts` | `COOKIE_NAME = "manus-session"` |

## How It Works

### JWT Creation (Google OAuth path, `googleAuthRoutes.ts`)
```typescript
const token = await new SignJWT({
  openId: user.openId,
  appId: "google-oauth",  // distinguishes from Manus tokens
  name: user.name || "",
  email: user.email,
  role: user.role,
})
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setIssuedAt()
  .setExpirationTime("7d")
  .sign(new TextEncoder().encode(JWT_SECRET));
```
- Algorithm: HS256
- Lifetime: **7 days**
- Secret: `JWT_SECRET` env var (falls back to `"fallback-secret-change-in-production"`)
- Extra fields (`email`, `role`) are included but not verified by `verifySession()` — they exist for potential future use

### JWT Verification (`sdk.ts` → `verifySession()`)
```typescript
const { payload } = await jwtVerify(cookieValue, secretKey, { algorithms: ['HS256'] });
const { openId, appId, name } = payload as Record<string, unknown>;
if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
  return null;
}
```
- Verifies signature, expiry, and algorithm
- Requires `openId`, `appId`, and `name` to all be **non-empty strings**
- Returns `{ openId, appId, name }` on success, `null` on any failure

### Request Authentication (`sdk.ts` → `authenticateRequest()`)
1. Parses `Cookie` header using the `cookie` library
2. Extracts `COOKIE_NAME` value
3. Calls `verifySession()`
4. If session valid: looks up user in DB via `getUserByOpenId(session.openId)`
5. If user not in DB (e.g., deleted): attempts to sync from Manus OAuth server via `getUserInfoWithJwt()` — this is a Manus-specific fallback that will fail silently for Google OAuth users
6. Throws `ForbiddenError` if no valid session

### tRPC Context (`context.ts`)
```typescript
try {
  user = await sdk.authenticateRequest(opts.req);
} catch (error) {
  user = null; // auth is optional for public procedures
}
```
- All errors are caught and result in `user = null`
- Public procedures operate with `ctx.user = null`
- Protected procedures check `ctx.user !== null` inside tRPC middleware

### Cookie Options (`cookies.ts`)
```typescript
{
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: isSecureRequest(req),  // true if HTTPS (checks x-forwarded-proto)
}
```
- `secure` is dynamically determined per request (supports Nginx reverse proxy)
- `sameSite: "lax"` — protects against CSRF while allowing OAuth GET redirects
- No `domain` set — defaults to exact hostname (cookie not shared across subdomains)

### Logout (`routers.ts` auth.logout)
```typescript
ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
```
- Cookie cleared by setting `maxAge: -1` with matching options
- Server-side logout only — JWT is not blocklisted (stateless)

## Data Flow (authenticated request)
```
1. Browser sends request with Cookie: manus-session=<jwt>
2. context.ts: sdk.authenticateRequest(req) called
3. sdk.ts: parseCookies() extracts JWT from cookie header
4. sdk.ts: verifySession() → jwtVerify() validates signature + expiry
5. sdk.ts: payload.openId extracted
6. db.ts: getUserByOpenId(openId) → SELECT from users table
7. Full User object returned → ctx.user populated
8. tRPC middleware checks ctx.user for protected procedures
```

## Edge Cases & Error Handling
- **Expired JWT**: `jwtVerify` throws → caught in `authenticateRequest` → `ForbiddenError` → context sets `user = null`
- **Tampered JWT**: signature verification fails → same path
- **User deleted from DB**: `getUserByOpenId` returns null → `authenticateRequest` tries Manus fallback (fails for Google users) → throws → `user = null`
- **Missing cookie**: `verifySession(undefined)` returns null immediately

## ⚠️ Security Issue: Empty Name Breaks JWT Verification
In `googleAuthRoutes.ts`:
```typescript
name: user.name || "",
```
If a Google user has no display name, `name = ""`. The `verifySession()` function requires `isNonEmptyString(name)` — empty string fails this check. **A user with no display name cannot log in.** Google profiles always have a display name, so this is low-probability but technically a latent bug.

## Security Observations
- No token rotation on re-use (stateless — fine for this use case)
- No token revocation list — logout only clears the client cookie; stolen tokens remain valid for 7 days
- Manus tokens use `ONE_YEAR_MS` (1 year) vs Google tokens' 7 days — inconsistent lifetime depending on auth provider
- `JWT_SECRET` fallback is a hardcoded string — must be overridden in production
- The `email` and `role` fields in the JWT are present but ignored during verification — role could theoretically be used to skip DB lookup, but currently is not

## Assumptions
- `COOKIE_NAME = "manus-session"` (from `shared/const.ts`) — kept as-is even though auth is now Google-based
- Both Google and Manus JWTs share the same verification path and secret — this is deliberate coupling, not accidental
