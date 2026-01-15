import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { passport } from "./googleAuth";
import { SignJWT } from "jose";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-production";
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
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  /**
   * Initiate Google OAuth flow
   * Redirects user to Google login page
   */
  app.get(
    "/api/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  /**
   * Google OAuth callback
   * Handles the redirect from Google after authentication
   */
  app.get(
    "/api/auth/callback/google",
    passport.authenticate("google", {
      failureRedirect: "/login-failed",
      session: false, // We'll use JWT instead of sessions
    }),
    async (req: Request, res: Response) => {
      try {
        console.log("[Google OAuth] Callback received");
        const user = req.user as any;
        console.log("[Google OAuth] User from passport:", user ? { openId: user.openId, email: user.email, name: user.name } : "null");

        if (!user) {
          console.error("[Google OAuth] No user returned from passport");
          return res.redirect("/login-failed");
        }

        // Create JWT token - must include openId, appId, and name for verifySession compatibility
        const token = await new SignJWT({
          openId: user.openId,
          appId: "google-oauth", // Required by verifySession
          name: user.name || "",
          email: user.email,
          role: user.role,
        })
          .setProtectedHeader({ alg: "HS256", typ: "JWT" })
          .setIssuedAt()
          .setExpirationTime("7d")
          .sign(new TextEncoder().encode(JWT_SECRET));

        console.log("[Google OAuth] JWT token created successfully");

        // Set cookie with JWT
        const cookieOptions = getSessionCookieOptions(req);
        console.log("[Google OAuth] Cookie options:", cookieOptions);
        console.log("[Google OAuth] Request protocol:", req.protocol);
        console.log("[Google OAuth] X-Forwarded-Proto:", req.headers["x-forwarded-proto"]);
        
        res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        console.log("[Google OAuth] Cookie set, redirecting to homepage");

        // Redirect to homepage
        res.redirect("/");
      } catch (error) {
        console.error("[Google OAuth] Error in callback:", error);
        res.redirect("/login-failed");
      }
    }
  );

  /**
   * Logout endpoint
   * Clears the session cookie
   */
  app.get("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.redirect("/");
  });

  console.log("[Google OAuth] Routes registered");
}
