export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  isProduction: process.env.NODE_ENV === 'production',

  // Forge proxy URL/key — used by server/storage.ts and server/_core/notification.ts
  // for the (currently dead) Manus S3 / Manus push-notification paths. Keep until
  // those modules are simplified to local-only / SMTP-only (round 2B).
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? '',
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? '',

  // SMTP — used by the contact form + (eventually) the rewritten notifyOwner
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  contactEmailTo: process.env.CONTACT_EMAIL_TO ?? '',
  contactEmailFrom: process.env.CONTACT_EMAIL_FROM ?? '',
};
