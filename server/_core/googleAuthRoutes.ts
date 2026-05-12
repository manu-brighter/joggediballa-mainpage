import type { Express, Request, Response } from 'express';
import cookieSession from 'cookie-session';
import { passport } from './googleAuth';
import { SignJWT } from 'jose';
import { COOKIE_NAME } from '../../shared/const';
import { getSessionCookieOptions } from './cookies';
import { ENV, getJwtSecretBytes } from './env';

/**
 * Register Google OAuth routes.
 *
 * Routes:
 * - GET  /api/auth/google             — initiate OAuth flow
 * - GET  /api/auth/callback/google    — OAuth callback
 * - POST /api/auth/logout             — log out (POST per CSRF policy, A-P0-04)
 *
 * Sessions: we replaced the in-process `express-session` MemoryStore
 * (F-SEC-018) with `cookie-session`, a signed, stateless cookie store. It only
 * exists to satisfy `passport-google-oauth20`'s requirement for somewhere to
 * stash the OAuth `state` parameter (A-P0-08). Authenticated sessions live in
 * the JWT cookie (`COOKIE_NAME`), not in this cookie.
 */
export function registerGoogleAuthRoutes(app: Express) {
  // Cookie-backed session ONLY for OAuth state (10 min lifetime). The signed
  // secret is distinct from JWT_SECRET. Both are fail-fast validated in env.ts.
  app.use(
    cookieSession({
      name: 'oauth_state',
      keys: [ENV.sessionSecret],
      maxAge: 10 * 60 * 1000, // 10 minutes — OAuth flow only
      httpOnly: true,
      secure: ENV.isProduction,
      sameSite: 'lax', // required: OAuth callback is a cross-site GET redirect
    }),
  );

  // Shim required by passport: it calls req.session.regenerate / req.session.save
  // (introduced in passport@0.7). cookie-session has neither, so we stub them.
  app.use((req, _res, next) => {
    const session = req.session as unknown as Record<string, unknown> | null;
    if (session) {
      if (typeof (session as { regenerate?: unknown }).regenerate !== 'function') {
        (session as { regenerate: (cb: (err?: unknown) => void) => void }).regenerate =
          cb => cb();
      }
      if (typeof (session as { save?: unknown }).save !== 'function') {
        (session as { save: (cb: (err?: unknown) => void) => void }).save = cb =>
          cb();
      }
    }
    next();
  });

  app.use(passport.initialize());
  // passport.session() is intentionally omitted — JWT cookie is the source of
  // truth for "is the user logged in". The cookie-session above only carries
  // OAuth state across the redirect.

  /**
   * Initiate Google OAuth flow.
   * `state: true` lets passport-google-oauth20 generate & verify a CSRF state
   * token automatically (stored in the cookie-session above).
   */
  app.get(
    '/api/auth/google',
    // passport-google-oauth20@2 types don't expose `state: true`, but the
    // underlying OAuth2 strategy honors it. Cast through unknown to opt in.
    passport.authenticate(
      'google',
      {
        scope: ['profile', 'email'],
        state: true,
      } as unknown as { scope: string[] },
    ),
  );

  /**
   * Google OAuth callback.
   */
  app.get(
    '/api/auth/callback/google',
    passport.authenticate('google', {
      failureRedirect: '/login-failed',
      session: false, // we issue our own JWT below
    }),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as
          | {
              openId: string;
              name?: string | null;
              email?: string | null;
              role: string;
            }
          | undefined;

        if (!user) {
          console.error('[Google OAuth] No user returned from passport');
          return res.redirect('/login-failed');
        }

        // Create JWT - must include openId, appId, and name for verifySession compatibility.
        const token = await new SignJWT({
          openId: user.openId,
          appId: 'google-oauth',
          name: user.name || '',
          email: user.email,
          role: user.role,
        })
          .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(getJwtSecretBytes());

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        console.log(
          `[Google OAuth] Login successful: ${user.email} (role: ${user.role})`,
        );

        // F-SEC-011: fixed-path redirect — no Host/X-Forwarded-Proto juggling.
        res.redirect('/');
      } catch (error) {
        console.error('[Google OAuth] Error in callback:', error);
        res.redirect('/login-failed');
      }
    },
  );

  /**
   * Logout — POST (A-P0-04 / F-SEC-005: state-changing endpoints must not be
   * triggerable from a cross-site GET). We accept POST only; the client must
   * be updated to POST instead of following a GET link.
   */
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.status(200).json({ success: true });
  });

  console.log('[Google OAuth] Routes registered');
}
