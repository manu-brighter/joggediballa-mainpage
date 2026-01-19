import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Profile } from "passport-google-oauth20";
import { upsertUser, getUserByOpenId } from "../db";
import type { User } from "../../drizzle/schema";
import { sendEmail } from "./email";

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

        // Determine role: ADMIN_EMAIL becomes admin, others start as visitor
        let role: "admin" | "maintainer" | "editor" | "user" | "visitor" = "visitor";
        if (email && ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          role = "admin";
        }

        // Check if user exists to determine if this is a new registration
        const existingUser = await getUserByOpenId(googleId);
        const isNewUser = !existingUser;

        // Upsert user in database
        await upsertUser({
          openId: googleId,
          email: email || null,
          name: name || null,
          loginMethod,
          role,
          lastSignedIn: new Date(),
        });

        // Send email notification for new visitor registrations
        if (isNewUser && role === "visitor") {
          // Send email asynchronously without blocking authentication
          sendEmail({
            to: process.env.CONTACT_EMAIL_TO || "joggediballa@gmail.com",
            subject: "Neue Benutzerregistrierung - Freischaltung erforderlich",
            text: `Neue Benutzerregistrierung: ${name || "Unbekannt"} (${email || "Keine E-Mail"}) wartet auf Freischaltung.`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0ea5e9;">Neue Benutzerregistrierung</h2>
                <p>Ein neuer Benutzer hat sich auf der Jogge di Balla Website registriert und wartet auf Freischaltung:</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Name:</strong> ${name || "Nicht angegeben"}</p>
                  <p><strong>E-Mail:</strong> ${email || "Nicht angegeben"}</p>
                  <p><strong>Login-Methode:</strong> Google OAuth</p>
                  <p><strong>Status:</strong> Visitor (wartet auf Freischaltung)</p>
                </div>
                <p>Bitte logge dich ins Admin-Dashboard ein, um den Benutzer freizuschalten:</p>
                <p><a href="${process.env.GOOGLE_CALLBACK_URL?.replace('/api/auth/callback/google', '')}/admin/users" style="background-color: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Zur Benutzerverwaltung</a></p>
              </div>
            `,
          })
            .then((result) => {
              if (result.success) {
                console.log("[Google OAuth] New visitor notification email sent");
              } else {
                console.warn("[Google OAuth] Failed to send notification email:", result.error);
              }
            })
            .catch((emailError) => {
              console.error("[Google OAuth] Email notification error:", emailError);
            });
        }

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
