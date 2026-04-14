import type { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { passport } from './googleAuth';
import { SignJWT } from 'jose';
import { COOKIE_NAME } from '../../shared/const';
import { getSessionCookieOptions } from './cookies';

const JWT_SECRET =
  process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const SESSION_SECRET = process.env.SESSION_SECRET || JWT_SECRET;

/**
 * Register Google OAuth routes
 *
 * Routes:
 * - GET /api/auth/google - Initiates Google OAuth flow
 * - GET /api/auth/callback/google - Handles OAuth callback
 * - GET /api/auth/logout - Logs out the user
 */
export function registerGoogleAuthRoutes(app: Express) {
  // Session middleware (required for passport)
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  /**
   * Initiate Google OAuth flow
   * Redirects user to Google login page
   */
  app.get(
    '/api/auth/google',
    passport.authenticate('google', {
      scope: ['profile', 'email'],
    }),
  );

  /**
   * Google OAuth callback
   * Handles the redirect from Google after authentication
   */
  app.get(
    '/api/auth/callback/google',
    passport.authenticate('google', {
      failureRedirect: '/login-failed',
      session: false, // We'll use JWT instead of sessions
    }),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;

        if (!user) {
          console.error('[Google OAuth] No user returned from passport');
          return res.redirect('/login-failed');
        }

        // Create JWT token - must include openId, appId, and name for verifySession compatibility
        const token = await new SignJWT({
          openId: user.openId,
          appId: 'google-oauth', // Required by verifySession
          name: user.name || '',
          email: user.email,
          role: user.role,
        })
          .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(new TextEncoder().encode(JWT_SECRET));

        // Set cookie with JWT
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Redirect to the same origin (supports localhost dev and production)
        const host = req.get('host') || 'localhost:3000';
        const protocol =
          req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const redirectUrl = `${protocol}://${host}/`;
        console.log(
          `[Google OAuth] Login successful: ${user.email} (role: ${user.role})`,
        );
        res.redirect(redirectUrl);
      } catch (error) {
        console.error('[Google OAuth] Error in callback:', error);
        res.redirect('/login-failed');
      }
    },
  );

  /**
   * Logout endpoint
   * Clears the session cookie
   */
  app.get('/api/auth/logout', (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.redirect('/');
  });

  console.log('[Google OAuth] Routes registered');
}
