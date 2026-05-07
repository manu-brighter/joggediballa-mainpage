export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  isProduction: process.env.NODE_ENV === 'production',

  // SMTP — used by the contact form (server/_core/email.ts)
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  contactEmailTo: process.env.CONTACT_EMAIL_TO ?? '',
  contactEmailFrom: process.env.CONTACT_EMAIL_FROM ?? '',
};
