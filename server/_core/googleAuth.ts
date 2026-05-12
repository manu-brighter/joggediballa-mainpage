import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Profile } from 'passport-google-oauth20';
import { upsertUser, getUserByOpenId, createActivityLog } from '../db';
import type { User } from '../../drizzle/schema';
import { sendEmail, escapeHtml } from './email';

/**
 * Google OAuth Configuration
 *
 * Setup:
 * 1. Create OAuth credentials in Google Cloud Console
 * 2. Set environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
 * 3. Configure authorized redirect URIs in Google Cloud Console
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  'http://localhost:3000/api/auth/callback/google';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn(
    '[Google OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Google OAuth will not work.',
  );
  console.warn(
    '[Google OAuth] Please follow GOOGLE_OAUTH_SETUP.md to configure Google OAuth.',
  );
}

/**
 * Configure Google OAuth Strategy
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID || 'placeholder',
      clientSecret: GOOGLE_CLIENT_SECRET || 'placeholder',
      callbackURL: GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile: Profile, done) => {
      try {
        // Use Google ID as openId
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const profilePictureUrl = profile.photos?.[0]?.value;
        const loginMethod = 'google';

        // Check if user exists to determine if this is a new registration
        const existingUser = await getUserByOpenId(googleId);
        const isNewUser = !existingUser;

        // Determine role: ADMIN_EMAIL becomes admin, others start as visitor
        // IMPORTANT: Only set role for NEW users, preserve existing user roles
        let role:
          | 'admin'
          | 'maintainer'
          | 'editor'
          | 'user'
          | 'visitor'
          | undefined = undefined;
        if (isNewUser) {
          role = 'visitor';
          // F-SEC-016: only auto-promote to admin if Google reports the email
          // is verified. Otherwise an attacker could spoof the admin email by
          // claiming it on an unverified Google account.
          const emailVerified = (profile as any)?._json?.email_verified === true;
          if (
            email &&
            emailVerified &&
            ADMIN_EMAIL &&
            email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
          ) {
            role = 'admin';
          } else if (
            email &&
            !emailVerified &&
            ADMIN_EMAIL &&
            email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
          ) {
            console.warn(
              '[Google OAuth] Admin email match but email_verified=false; refusing admin promotion.',
            );
          }
        }

        // Upsert user in database
        await upsertUser({
          openId: googleId,
          email: email || null,
          name: name || null,
          profilePictureUrl: profilePictureUrl || null,
          loginMethod,
          ...(role !== undefined && { role }), // Only include role for new users
          lastSignedIn: new Date(),
        });

        // Fetch the complete user record and log activity
        const user = await getUserByOpenId(googleId);

        if (user) {
          // Log login activity
          await createActivityLog({
            userId: user.id,
            userName: user.name || 'Unknown',
            action: isNewUser ? 'registration' : 'login',
            details: isNewUser
              ? `New user registered via Google OAuth`
              : `User logged in via Google OAuth`,
            ipAddress: null,
            userAgent: null,
          });
        }

        // Send email notification for new visitor registrations
        if (isNewUser && role === 'visitor' && user) {
          // Send email asynchronously without blocking authentication
          sendEmail({
            to: process.env.CONTACT_EMAIL_TO || 'joggediballa@gmail.com',
            subject: 'Neue Benutzerregistrierung - Freischaltung erforderlich',
            text: `Neue Benutzerregistrierung: ${name || 'Unbekannt'} (${email || 'Keine E-Mail'}) wartet auf Freischaltung.`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0ea5e9;">Neue Benutzerregistrierung</h2>
                <p>Ein neuer Benutzer hat sich auf der Jogge di Balla Website registriert und wartet auf Freischaltung:</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Name:</strong> ${escapeHtml(name || 'Nicht angegeben')}</p>
                  <p><strong>E-Mail:</strong> ${escapeHtml(email || 'Nicht angegeben')}</p>
                  <p><strong>Login-Methode:</strong> Google OAuth</p>
                  <p><strong>Status:</strong> Visitor (wartet auf Freischaltung)</p>
                </div>
                <p>Bitte logge dich ins Admin-Dashboard ein, um den Benutzer freizuschalten:</p>
                <p><a href="${escapeHtml(process.env.GOOGLE_CALLBACK_URL?.replace('/api/auth/callback/google', '') || '')}/admin/users" style="background-color: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Zur Benutzerverwaltung</a></p>
              </div>
            `,
          })
            .then(result => {
              if (result.success) {
                console.log(
                  '[Google OAuth] New visitor notification email sent',
                );
              } else {
                console.warn(
                  '[Google OAuth] Failed to send notification email:',
                  result.error,
                );
              }
            })
            .catch(emailError => {
              console.error(
                '[Google OAuth] Email notification error:',
                emailError,
              );
            });
        }

        if (!user) {
          return done(new Error('Failed to create or fetch user'));
        }

        return done(null, user);
      } catch (error) {
        console.error('[Google OAuth] Error during authentication:', error);
        return done(error as Error);
      }
    },
  ),
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
