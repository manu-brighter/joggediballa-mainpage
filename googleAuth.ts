import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Profile } from "passport-google-oauth20";
import { upsertUser, getUserByOpenId } from "../db";
import type { User } from "../../drizzle/schema";

/**
 * Google OAuth Configuration
 * 
 * This module replaces the Manus OAuth system with Google OAuth for self-hosting.
 * 
 * Setup:
 * 1. Create OAuth credentials in Google Cloud Console
 * 2. Set environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
 * 3. Configure authorized redirect URIs in Google Cloud Console
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/callback/google";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn("[Google OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Google OAuth will not work.");
  console.warn("[Google OAuth] Please follow GOOGLE_OAUTH_SETUP.md to configure Google OAuth.");
}

/**
 * Configure Google OAuth Strategy
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID || "placeholder",
      clientSecret: GOOGLE_CLIENT_SECRET || "placeholder",
      callbackURL: GOOGLE_CALLBACK_URL,
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile: Profile, done) => {
      try {
        // Use Google ID as openId
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const loginMethod = "google";

        // Determine role: first user with ADMIN_EMAIL becomes admin
        let role: "admin" | "maintainer" | "editor" | "user" = "user";
        if (email && ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          role = "admin";
        }

        // Upsert user in database
        await upsertUser({
          openId: googleId,
          email: email || null,
          name: name || null,
          loginMethod,
          role,
          lastSignedIn: new Date(),
        });

        // Fetch the complete user record
        const user = await getUserByOpenId(googleId);
        
        if (!user) {
          return done(new Error("Failed to create or fetch user"));
        }

        return done(null, user);
      } catch (error) {
        console.error("[Google OAuth] Error during authentication:", error);
        return done(error as Error);
      }
    }
  )
);

/**
 * Serialize user to session
 */
passport.serializeUser((user: any, done) => {
  done(null, user.openId);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser(async (openId: string, done) => {
  try {
    const user = await getUserByOpenId(openId);
    done(null, user || null);
  } catch (error) {
    done(error);
  }
});

export { passport };
