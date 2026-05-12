# Security Audit Report
**Date:** 2026-05-12
**Auditor:** Security Engineer (subagent)
**Scope:** Full-stack security review

## Executive Summary
- **CRITICAL — HTML injection / Stored XSS in notification emails:** `sendContactFormEmail` and `sendHarassenlaufEmail` interpolate unsanitized user input directly into HTML email bodies. Any user can send HTML/JS to admin inboxes (mail-client XSS, phishing).
- **CRITICAL — JWT signing secret falls back to a hardcoded literal** (`fallback-secret-change-in-production`) when `JWT_SECRET` is missing. Anyone running the published binary without the env-var (or who reads the source) can forge admin JWTs.
- **CRITICAL — Unauthenticated file-upload endpoints with no size cap.** All `/api/upload/*` routes accept multipart uploads with no auth, no size limit, and pipe attacker-controlled buffers into `sharp()` (decompression-bomb / disk-fill / S3-cost DoS).
- **HIGH — OAuth callback has no CSRF `state` parameter and no PKCE.** `passport-google-oauth20` is invoked without `state: true`, allowing login-CSRF / account-fixation.
- **HIGH — All state-changing tRPC mutations are CSRF-vulnerable.** `SameSite=lax` + a top-level navigation can trigger GET-side effects (`/api/auth/logout` is a GET that mutates state), and POST tRPC has no custom-header or origin check.
- **HIGH — Broad authorization gaps in `attendance` router:** every procedure uses `protectedProcedure` only, so any logged-in `user` (even auto-created `visitor` accounts after promotion) can create/update/delete attendance data; `harassenlauf.register` and `contact.send` have no per-IP/per-procedure rate limiting (tRPC explicitly skipped by Express limiter).
- **HIGH — `events.list`, `photos.listAll`, `photos.listByEvent` leak unpublished/draft content** to the public when not authenticated due to `getAllEvents(false)` always returning all events.

## Findings

### F-SEC-001: JWT/session signing secret falls back to a hardcoded literal
- **Severity:** critical
- **Effort:** small (<30min)
- **Location:** `server/_core/googleAuthRoutes.ts:8-10`, `server/_core/env.ts:2`
- **Issue:** `const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';` and `SESSION_SECRET = process.env.SESSION_SECRET || JWT_SECRET`. The verify side reads `ENV.cookieSecret = process.env.JWT_SECRET ?? ''`, which means **sign-side falls back to a public literal while verify-side falls back to empty string**, but `jose.SignJWT(...).sign(new TextEncoder().encode(''))` would also work if `process.env.JWT_SECRET` is unset on the verifier — and worse, **an attacker who knows the source can mint admin tokens against any deployment that forgets to set `JWT_SECRET`**.
- **Recommendation:** Fail fast at boot: in `env.ts`, throw if `JWT_SECRET` is missing or shorter than 32 chars; remove the literal fallback in `googleAuthRoutes.ts`. Use a separate `SESSION_SECRET` (never reuse the JWT secret for `express-session`).
- **Rationale:** OWASP ASVS V3.5 / V6.2: cryptographic keys must never have an in-source default. NIST SP 800-63B treats hardcoded secrets as a top-tier finding.

### F-SEC-002: Stored HTML-injection in notification emails (admin-targeted XSS)
- **Severity:** critical
- **Effort:** medium (1-4h)
- **Location:** `server/_core/email.ts:92-105` (contact), `server/_core/email.ts:175-208` (harassenlauf), `server/_core/googleAuth.ts:115-127` (new-user notification)
- **Issue:** User-supplied `name`, `email`, `subject`, `message`, `teamName`, `captainFirstName/LastName`, `additionalInfo`, `data.email`, OAuth profile `name`/`email` are all interpolated raw into an HTML string with **no escaping**. The contact form even runs `data.message.replace(/\n/g, '<br>')` after embedding raw HTML — `<script>`, `<img onerror>`, `<a href="javascript:">`, hidden iframes are all delivered to the admin inbox. Modern mail clients sandbox `<script>` but **not** `<img onerror>`, CSS-based exfiltration, or phishing payloads; some webmail UIs (older Outlook, custom interfaces) still execute scripts. The HTML `from`/`replyTo` header is also built from `name` + `email` without RFC-5322 sanitization → header injection / spoof potential.
- **Recommendation:** HTML-escape every interpolated value (reuse the `escapeXml` helper from `sitemap.ts` or import `escape-html`). Strip CR/LF from any value used in mail headers (`replyTo`). Apply Zod refinements rejecting `\r\n` in `name`/`subject`/`email` server-side.
- **Rationale:** OWASP A03:2021 (Injection). HTML email is the same threat surface as HTML in a browser; even if the mail client is hardened, you're emitting a malicious payload through your own SMTP server.

### F-SEC-003: Unauthenticated, unbounded file-upload routes
- **Severity:** critical
- **Effort:** medium (1-4h)
- **Location:** `server/uploadRoutes.ts:56-353`, `server/_core/index.ts:76-94`
- **Issue:** All four endpoints (`/api/upload/profile-picture`, `/sponsor-logo`, `/event-photo`, `/team-member-photo`) are registered without any auth middleware. There is **no `Content-Length` check, no per-chunk byte cap**, and the implementation streams everything into memory via `chunks.push(chunk)` before validating. An anonymous attacker can:
  1. Fill the local upload disk (and DB-tracked S3 keys) with junk.
  2. Send a 10 GB request to exhaust Node memory (server has `--max-old-space-size=512` in `ecosystem.config.cjs`).
  3. Feed a "decompression bomb" PNG (40000×40000 px) into `sharp(fileBuffer).resize(...)` — `sharp` will allocate the full decoded bitmap (~6 GB) before failing.
  4. MIME type is taken from the **multipart `Content-Type` header**, which is attacker-supplied; no magic-byte check. Combined with a `.jpg` extension chosen from the attacker's filename (`fileName.split('.').pop()`), arbitrary content (HTML, SVG with JS) can be uploaded and later served from your `joggediballa.ch/uploads/` origin → **stored XSS on your own domain** (same-origin with the session cookie).
  5. `path.join(uploadDir, key)` in `storage.ts:39` joins attacker-influenced extension into a path; combined with the lack of validation on `fileName` (could contain `../` if the attacker crafts the multipart manually), local-path traversal is plausible.
- **Recommendation:**
  1. Wrap every upload route in an auth middleware (`requireRole('editor')` or similar — these are admin-only operations in practice).
  2. Use `multer` (or `busboy`) with `limits.fileSize` (e.g. 10 MB) and `limits.files: 1`. Reject large bodies before buffering.
  3. Limit `sharp` via `.limitInputPixels(50_000_000)` and verify with `sharp.metadata()` before resize.
  4. Sniff MIME via `file-type` library on the buffer; reject anything not in an allowlist (`image/jpeg`, `image/png`, `image/webp`).
  5. Sanitize extension to a whitelist; never trust the client's `fileName`.
  6. Configure nginx to serve `/uploads/` with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` to block stored-XSS through HTML/SVG uploads.
- **Rationale:** OWASP File Upload Cheat Sheet; CWE-434, CWE-400. `sharp` security advisories repeatedly recommend `limitInputPixels`.

### F-SEC-004: OAuth flow has no `state`, no PKCE
- **Severity:** high
- **Effort:** small (<30min)
- **Location:** `server/_core/googleAuthRoutes.ts:43-48`
- **Issue:** `passport.authenticate('google', { scope: ['profile', 'email'] })` is invoked without `state: true`. Express-session is configured, but Passport won't generate/verify the state parameter without it. This enables login-CSRF (attacker logs the victim into the attacker's Google account). PKCE is also not enabled (`pkce: true`).
- **Recommendation:** `passport.authenticate('google', { scope: [...], state: true, pkce: true })` and on the strategy `store: true`. Or migrate to a library that enforces both by default (`openid-client`).
- **Rationale:** OAuth 2.0 Security BCP (RFC 9700, March 2025) mandates `state` + PKCE for all clients including confidential.

### F-SEC-005: Missing CSRF protection on cookie-authenticated mutations
- **Severity:** high
- **Effort:** medium (1-4h)
- **Location:** `server/_core/index.ts:85-91`, `server/routers.ts:88-95` (`auth.logout`), `server/uploadRoutes.ts:*`
- **Issue:** All authenticated state-changing endpoints rely solely on `SameSite=Lax` JWT cookie. SameSite=Lax does **not** block top-level POST navigations from the attacker's site, and `auth.logout` is a `GET` mutation that DOES get sent on cross-site navigation (Lax permits top-level GET). The tRPC client does not send a CSRF token nor a `Origin`/custom header check is enforced server-side.
- **Recommendation:**
  - Server-side: in `createContext` (or an Express middleware before `/api/trpc` and `/api/upload`), require either (a) `Origin` header matching the app origin for state-changing requests, or (b) a custom `x-trpc-source`/CSRF header (already common practice with tRPC). Reject if missing.
  - Change `/api/auth/logout` from `GET` to `POST` and require the same origin check.
  - Upgrade the session cookie to `SameSite=Strict` if possible, otherwise add a double-submit CSRF token for uploads.
- **Rationale:** OWASP CSRF Cheat Sheet (2025): SameSite=Lax is defense-in-depth, not a primary CSRF defense, and is bypassable via top-level POST in older browsers and via subdomain takeover (no domain cookie scoping is set).

### F-SEC-006: `attendance` router is fully open to any authenticated user
- **Severity:** high
- **Effort:** small (<30min)
- **Location:** `server/attendance_router.ts:22-242`
- **Issue:** Every procedure in `attendanceRouter` uses `protectedProcedure` — meaning the lowest role (`user`, even `visitor` after upgrade) can read **and mutate** all attendance sessions, members, records, and settings. A visitor who has just been auto-created can call `attendance.deleteSession`, `deleteMember`, `saveAttendance`, `updateEventWeight`, etc. The existing role/permission system (`requirePermission('manage_attendance')`) is not used here.
- **Recommendation:** Introduce an `attendance` permission key in `permissions.ts` and gate every mutation behind `requirePermission('manage_attendance')`. Reads of internal attendance data should at minimum require the `user` role explicitly.
- **Rationale:** OWASP A01:2021 Broken Access Control. The two-permission-style coexistence noted in the project context creates exactly this kind of forgotten path.

### F-SEC-007: Unpublished/draft events and photos leak to public
- **Severity:** high
- **Effort:** small (<30min)
- **Location:** `server/routers.ts:278-282` (`events.list`), `server/db.ts:365-372`, `server/routers.ts:284-288` (`events.getById` has no isPublished filter)
- **Issue:** `events.list` calls `db.getAllEvents(false)` (always returns all events including `isPublished=false`). `events.getById` does not check `isPublished` at all. `photos.listByEvent` does filter by `publishedOnly = !isAuthenticated`, but the unpublished-event problem means a public viewer can iterate IDs (`getById` is public + takes a number) and read draft content, locations, and link URLs that should be hidden.
- **Recommendation:** Pass `publishedOnly = !ctx.user` (or `!user || role==='visitor'`) into `getAllEvents` and add the same filter to `getEventById`. Audit `sponsors`, `goennermitglieder` (this one is already gated to authenticated, good) similarly.
- **Rationale:** A01:2021 Broken Access Control; principle of least exposure.

### F-SEC-008: Rate-limiter explicitly skips tRPC, leaving login/contact/upload abusable
- **Severity:** high
- **Effort:** medium (1-4h)
- **Location:** `server/_core/index.ts:65-73`
- **Issue:** The Express rate-limiter explicitly skips `/api/trpc/*` to accommodate the shotcounter overlay polling. That removes throttling from `contact.send`, `harassenlauf.register`, `auth.logout`, `users.*`, etc. — exactly the procedures most worth abusing (mail-flood, registration spam, brute-force of any future password procedure). `/api/upload/*` is also not auth-gated (see F-SEC-003) and not separately throttled. The CLAUDE.md acknowledges this but no tRPC-side middleware has been written.
- **Recommendation:** Add a per-procedure tRPC middleware that consults a token-bucket keyed on `req.ip` for sensitive procedures (`contact.send`, `harassenlauf.register`, anything in `auth`, `users`, uploads). Keep the broad Express limiter as defense-in-depth and add a stricter route-specific `rateLimit` on `/api/auth/*` and `/api/upload/*`.
- **Rationale:** OWASP A04:2021 Insecure Design / Lack of rate limiting; CWE-307.

### F-SEC-009: Helmet CSP disabled in production
- **Severity:** high
- **Effort:** medium (1-4h)
- **Location:** `server/_core/index.ts:49-58`
- **Issue:** `helmet({ contentSecurityPolicy: false })`. Combined with the stored-XSS vector via `/uploads/` (F-SEC-003) and `dangerouslySetInnerHTML` in `client/src/components/ui/chart.tsx:81` (recharts-style injection — admin-controlled, but still), there is no CSP defense-in-depth. The `helmet` config also drops `Cross-Origin-Resource-Policy`, `Cross-Origin-Opener-Policy` defaults that helmet 8 ships with — actually verify those are still on; CSP is explicitly off though.
- **Recommendation:** Enable a strict CSP: `default-src 'self'; script-src 'self'; img-src 'self' https://joggediballa.ch https://*.googleusercontent.com data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`. Add a nonce for the chart `<style dangerouslySetInnerHTML>` block. Set `Permissions-Policy` to deny camera/microphone/geolocation.
- **Rationale:** MDN CSP guidance 2025; OWASP A05:2021 Security Misconfiguration.

### F-SEC-010: `sharp` allows decompression-bomb input
- **Severity:** high
- **Effort:** small (<30min)
- **Location:** `server/uploadRoutes.ts:224-246` (event photo), `:322-333` (team photo)
- **Issue:** `sharp(fileBuffer).resize(...)` is called with no `.limitInputPixels()` and no preflight `.metadata()` check. A 100×100-byte malicious PNG/WebP can decode to gigabytes. Combined with no auth on the route (F-SEC-003) this is one curl away from OOM.
- **Recommendation:** `sharp(fileBuffer, { limitInputPixels: 50_000_000, failOn: 'error' })` before any chain; reject if `metadata.width * metadata.height > 50_000_000`.
- **Rationale:** sharp's own security docs; CVE-2017-12132 class of bugs.

### F-SEC-011: Open redirect in OAuth post-login redirect
- **Severity:** medium
- **Effort:** small (<30min)
- **Location:** `server/_core/googleAuthRoutes.ts:90-97`
- **Issue:** `const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http'; const host = req.get('host') || 'localhost:3000'; res.redirect(\`${protocol}://${host}/\`);`. `host` and `x-forwarded-proto` are attacker-controlled (`Host` header injection if not pinned in nginx, and a stray `x-forwarded-proto: javascript` would yield `javascript://...` — though `res.redirect` typically URL-validates; still trusting these headers is bad practice). It also leaks the OAuth-success endpoint to whatever Host the caller chose.
- **Recommendation:** Redirect to a fixed path: `res.redirect('/')`. If you ever need cross-domain redirects, validate against an explicit allowlist.
- **Rationale:** OWASP Unvalidated Redirects; CWE-601.

### F-SEC-012: Sensitive user fields (openId, email, role, login method) leak via `auth.me`
- **Severity:** medium
- **Effort:** small (<30min)
- **Location:** `server/routers.ts:89` (`auth.me`), `server/routers.ts:101-103` (`users.list`)
- **Issue:** `auth.me` returns `ctx.user` directly — the full DB row including `openId` (Google ID), `loginMethod`, internal `id`, timestamps. `users.list` returns the same for admins (fine) but `getAllUsers` is selecting `*`. For the current user, only the necessary projection should be exposed.
- **Recommendation:** Project to a safe DTO (`id`, `displayName`, `role`, `profilePictureUrl`, `email`). Never return `openId` to the client; it's the JWT subject. For admin lists, project away `openId` and any future password/token columns.
- **Rationale:** Defense in depth — minimizes the impact of any client-side XSS or data exfiltration. OWASP A04:2021.

### F-SEC-013: SQL fragment built with template literals in attendance statistics (low-risk Drizzle context)
- **Severity:** medium
- **Effort:** small (<30min)
- **Location:** `server/attendance_db.ts:297-300`
- **Issue:** `sql\`${attendanceRecords.sessionId} IN (SELECT id FROM attendance_sessions WHERE YEAR(date) = ${year})\`` — Drizzle's `sql` tag parameterizes the `${year}` binding so this is safe today, but the pattern is fragile: if a future contributor inserts a raw string with `sql.raw(userInput)` here, injection would result. The session-cookie filter is constructed via raw SQL `1=1` which is fine but inconsistent.
- **Recommendation:** Replace with `inArray(attendanceRecords.sessionId, db.select({id: attendanceSessions.id}).from(attendanceSessions).where(...))` to keep everything in the typed builder.
- **Rationale:** Drizzle docs — prefer the relational builder over `sql\`\`` for filterable values; eliminates surface area for future regressions.

### F-SEC-014: Unbounded text inputs in mutations
- **Severity:** medium
- **Effort:** small (<30min)
- **Location:** `server/routers.ts` — `events.description`, `team.bio`, `goennermitglieder.notes`, `sdkSession.gameNames`, `attendance.notes`, `permissions.toggle.permissionKey` (no `.max`)
- **Issue:** Many Zod schemas use `z.string()` (or `.optional()`) with no `.max(N)`. A 100 MB description can be submitted, gets `JSON.stringify`'d in `eventLinks`, and stored in `text` columns (up to 64 KB in MySQL `TEXT`, but the JSON serialization will throw at runtime, exposing the call to DoS).
- **Recommendation:** Add `.max(10_000)` (or appropriate) to every `z.string()` server-side. Express body limit of 1 MB helps but isn't sufficient when batched.
- **Rationale:** OWASP A04 — secure-by-design input bounding.

### F-SEC-015: `permissions.toggle` accepts arbitrary `permissionKey` string
- **Severity:** medium
- **Effort:** small (<30min)
- **Location:** `server/routers.ts:836-851`, `server/db.ts:920-957`
- **Issue:** `permissionKey: z.string()` — an admin can create arbitrary permission rows. Not directly exploitable (admin only), but pollutes the table and breaks the in-memory cache invalidation since invalid keys never match. Also `getMyPermissions` returns the full list — fine, but admins can spell new keys that silently grant nothing.
- **Recommendation:** Validate against a fixed `z.enum([...])` of supported permission keys, OR introduce a `permissions_catalog` table and enforce FK.
- **Rationale:** Best practice; reduces accidental privilege-escalation paths.

### F-SEC-016: First-user admin promotion via case-insensitive email match is unverified email
- **Severity:** medium
- **Effort:** small (<30min)
- **Location:** `server/_core/googleAuth.ts:50-77`
- **Issue:** `email = profile.emails?.[0]?.value` and `email.toLowerCase() === ADMIN_EMAIL.toLowerCase()` — `passport-google-oauth20` does NOT check `email_verified` from Google's userinfo. Google verifies all `@gmail.com` addresses, but for Google Workspace domains, the email field can in principle be unverified. Combined: someone in your Workspace with the admin alias gets admin without an extra check.
- **Recommendation:** Use `profile.emails?.[0]?.verified` (the strategy exposes `_json.email_verified`); require `verified === true` AND exact email match before assigning admin role. Better: assign admin out-of-band (manual DB update) rather than on first login.
- **Rationale:** Google OAuth security guidance — never trust the email scope for authorization.

### F-SEC-017: Session cookie missing `domain` and `__Host-` prefix
- **Severity:** medium
- **Effort:** small (<30min)
- **Location:** `server/_core/cookies.ts:25-49`, `shared/const.ts:1`
- **Issue:** `COOKIE_NAME = 'app_session_id'`; commented-out `domain` logic; no `__Host-` or `__Secure-` prefix. Without `__Host-`, a subdomain takeover on `*.joggediballa.ch` could set a cookie that overrides the session.
- **Recommendation:** Rename to `__Host-app_session` (requires `Secure`, `Path=/`, no `Domain` — exactly your current shape) so browsers refuse to accept any sub-domain-scoped variant.
- **Rationale:** RFC 6265bis cookie prefixes; current CHIPS/cookie security guidance.

### F-SEC-018: `express-session` configured even though sessions are not used
- **Severity:** medium
- **Effort:** small (<30min)
- **Location:** `server/_core/googleAuthRoutes.ts:21-37`, `:56-59`
- **Issue:** `passport.session()` is called, but the OAuth callback uses `session: false`. The session middleware still creates server-memory sessions (default `MemoryStore`) on every Passport handshake, and the `connect.sid` cookie is set with `secure: process.env.NODE_ENV === 'production'` — meaning in development, it's served over HTTP without `Secure`. Default `MemoryStore` is documented as **not for production** (memory leak + no horizontal scaling).
- **Recommendation:** Since you don't use sessions, remove `app.use(session(...))` and `passport.session()` entirely. Keep `passport.initialize()` only. If you keep sessions for OAuth state, use a real store (Redis/MySQL) and set `cookie.sameSite: 'lax'` explicitly.
- **Rationale:** express-session docs + Snyk advisories against MemoryStore in production.

### F-SEC-019: Multipart parser uses `toString('binary')` round-trip — file corruption + memory risk
- **Severity:** medium
- **Effort:** medium (1-4h)
- **Location:** `server/uploadRoutes.ts:9-53`
- **Issue:** The hand-rolled parser does `body.toString('binary').split(...)`. The `'binary'` encoding is deprecated and lossy for high-byte sequences; PNGs round-trip correctly only by accident. It also doubles memory usage (string + buffer). The `lastIndexOf('\r\n')` heuristic for the content end is brittle.
- **Recommendation:** Replace with `multer` (memoryStorage or diskStorage with limits) — also fixes F-SEC-003 size limits.
- **Rationale:** Node `Buffer` docs deprecate `binary`; CWE-20 input validation.

### F-SEC-020: Wouter patch leaks all client-side route paths to `window`
- **Severity:** low
- **Effort:** small (<30min)
- **Location:** `patches/wouter@3.7.1.patch`
- **Issue:** The patch pushes every `<Route path>` into `window.__WOUTER_ROUTES__`. This exposes the full set of admin/internal route paths (`/admin/users`, `/admin/permissions`, the SDK overlay routes) to any script running on the page, including third-party scripts (none today, but future) and any XSS payload. Doesn't grant access, but eases reconnaissance.
- **Recommendation:** Remove the patch — it's only useful for dev tooling. If you need it, gate with `if (import.meta.env.DEV)`.
- **Rationale:** Information disclosure (CWE-200).

### F-SEC-021: HSTS `preload` + `includeSubDomains` set without owning all subdomains
- **Severity:** low
- **Effort:** small (<30min)
- **Location:** `server/_core/index.ts:52-56`
- **Issue:** `hsts.includeSubDomains: true, preload: true` + 2-year max-age means every subdomain of joggediballa.ch is forced to HTTPS forever on browsers that pick it up. If you ever need a non-HTTPS subdomain (e.g. for a hardware device), you cannot.
- **Recommendation:** Only set `preload` once you've submitted to hstspreload.org and confirmed all subdomains are HTTPS-ready. Otherwise drop `preload` (you keep the HSTS protection without the irreversibility).
- **Rationale:** hstspreload.org guidance — preload is one-way.

### F-SEC-022: Error responses leak internals via console
- **Severity:** low
- **Effort:** small (<30min)
- **Location:** Many — `googleAuth.ts:155`, `db.ts:111`, `uploadRoutes.ts:104,165,...`, `email.ts:42`
- **Issue:** `console.error(error)` writes raw error objects (with stack traces, DB error codes, ER_DUP_ENTRY messages) to stdout. PM2 captures this to log files; if logs are mounted/shared or shipped to a third-party log aggregator, this leaks DB schema and auth flow details. The tRPC TRPCError messages are also returned to the client raw (e.g. `Permission '${permissionKey}' required` echoes the permission key).
- **Recommendation:** Introduce a small logger that strips stack traces in production, OR pipe to a real logger (pino) with redaction. Sanitize tRPC error messages — return generic codes (`FORBIDDEN`) without specifics.
- **Rationale:** OWASP A09:2021 Security Logging and Monitoring Failures.

### F-SEC-023: `client_secret` falls back to literal `'placeholder'`
- **Severity:** low
- **Effort:** small (<30min)
- **Location:** `server/_core/googleAuth.ts:41-43`
- **Issue:** `clientID: GOOGLE_CLIENT_ID || 'placeholder', clientSecret: GOOGLE_CLIENT_SECRET || 'placeholder'`. The OAuth handshake fails with these values, so this is a usability fallback, not exploitable. But it masks a misconfiguration that should be fatal.
- **Recommendation:** Throw on boot if either is missing (as already warned).
- **Rationale:** Fail-fast on misconfiguration.

### F-SEC-024: IP address taken directly from `X-Forwarded-For` header
- **Severity:** low
- **Effort:** small (<30min)
- **Location:** `server/routers.ts:607-610`
- **Issue:** `ipAddress: ctx.req?.ip || (ctx.req?.headers['x-forwarded-for'] as string) || null` — if `ctx.req.ip` resolution falls through (unlikely behind nginx with `trust proxy 1`), this writes the raw client-supplied `x-forwarded-for` (could be `1.1.1.1, 2.2.2.2`, attacker-spoofed). With `trust proxy 1`, only the first hop is trusted; the rest of the chain is untrusted. Stored "IP" for contact-submission audit is meaningless if attacker-supplied.
- **Recommendation:** Use only `ctx.req.ip` after configuring `trust proxy` correctly; drop the `x-forwarded-for` fallback.
- **Rationale:** Express docs on proxy trust; CWE-345.

## Cross-Domain Notes
- **Dependency audit** (own report): `passport-google-oauth20@2.0.0` is unmaintained — last release 2021; consider `openid-client`. `nanoid` is pinned to `3.3.7` via `pnpm.overrides` for tailwind transitive but the main dep uses `^5.1.5` — both OK. `axios@^1.12.0` — current LTS; verify no transitive CVEs.
- **DevOps / deploy** (own report): `MemoryStore` warning at boot (F-SEC-018) will show in PM2 logs and is being ignored. PM2 fork mode (single instance) means in-memory permission cache is fine, but if you ever scale to cluster, that cache desynchronizes across workers.
- **Frontend/UX** (own report): Several admin routes are visible in client bundle; the wouter patch (F-SEC-020) makes them grep-able. Consider lazy-loading admin routes.

## Methodology
1. Read `package.json`, `ecosystem.config.cjs`, `.env.example`, top-level `CLAUDE.md`, server/client/drizzle CLAUDE.md files to understand the stack.
2. Read every file in `server/_core/` (index, googleAuthRoutes, googleAuth, sdk, context, cookies, trpc, env, email, systemRouter).
3. Read the entire `server/routers.ts` (1026 lines), `server/uploadRoutes.ts`, `server/storage.ts`, `server/sitemap.ts`, `server/db.ts`, `server/permissions.ts`, `server/attendance_router.ts`, `server/attendance_db.ts`.
4. Reviewed `drizzle/schema.ts` for sensitive columns (PII, secrets, FK constraints) and patches/wouter@3.7.1.patch.
5. Greps run: `dangerouslySetInnerHTML` (1 hit, ui/chart.tsx — benign), `sql\`` (1 hit, attendance_db.ts), `csrf|cors|Authorization|Bearer` (none), `credentials.*include` (confirmed cookie-auth + no CSRF token), `streamdown|markdown|innerHTML` in client (none).
6. Verified absence of any auth middleware on `/api/upload/*` and any CSRF middleware in `_core/index.ts`.
7. Checked Zod schemas across `routers.ts` for missing `.max()` bounds.
8. Read `client/src/main.tsx` to confirm tRPC link config and CSRF posture.

Tools used: Read, Glob, Grep. No code modifications were made (audit-only mandate).
