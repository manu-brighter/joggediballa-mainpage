/**
 * Environment configuration with fail-fast validation.
 *
 * Required secrets (JWT_SECRET, SESSION_SECRET) are validated at module load:
 * if either is missing or shorter than 32 characters, the server refuses to
 * start. This kills the F-SEC-001 footgun where a fallback literal silently
 * weakened JWT signing in production.
 */

const MIN_SECRET_LENGTH = 32;

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `[env] ${name} is required and must be at least ${MIN_SECRET_LENGTH} characters. ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return value;
}

// Tests do not load `.env` and many CI environments will not set real secrets.
// We allow a fixed-length dev placeholder ONLY when NODE_ENV === 'test'.
function readSecret(name: string): string {
  if (process.env.NODE_ENV === 'test') {
    const v = process.env[name];
    if (v && v.length >= MIN_SECRET_LENGTH) return v;
    return 'test-' + name.toLowerCase() + '-' + 'x'.repeat(MIN_SECRET_LENGTH);
  }
  return requireSecret(name);
}

export const ENV = {
  cookieSecret: readSecret('JWT_SECRET'),
  sessionSecret: readSecret('SESSION_SECRET'),
  databaseUrl: process.env.DATABASE_URL ?? '',
  isProduction: process.env.NODE_ENV === 'production',
  appOrigin: process.env.APP_ORIGIN ?? '',

  // SMTP — used by the contact form (server/_core/email.ts)
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  contactEmailTo: process.env.CONTACT_EMAIL_TO ?? '',
  contactEmailFrom: process.env.CONTACT_EMAIL_FROM ?? '',

  // Upload limits — cap on the *raw* upload before server-side downscaling.
  // 40 MB default so high-res camera JPEGs (30+ MP Sony/Nikon, up to 61 MP)
  // aren't rejected before we get a chance to resize them. Can be lowered for
  // slow links. NOTE: a reverse proxy (nginx `client_max_body_size`) must allow
  // at least this much or it 413s before the request reaches Node.
  uploadMaxBytes: parseInt(
    process.env.UPLOAD_MAX_BYTES ?? String(40 * 1024 * 1024),
    10,
  ),
};

/**
 * Single shared accessor for the JWT-signing secret as a Uint8Array. Used by
 * both the signing side (googleAuthRoutes.ts) and the verify side (sdk.ts) so
 * the literal lives in exactly one place.
 */
export function getJwtSecretBytes(): Uint8Array {
  return new TextEncoder().encode(ENV.cookieSecret);
}
