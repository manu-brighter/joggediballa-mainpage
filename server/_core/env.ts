export const ENV = {
  appId: process.env.VITE_APP_ID ?? '',
  cookieSecret: process.env.JWT_SECRET ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  ownerOpenId: process.env.OWNER_OPEN_ID ?? '',
  isProduction: process.env.NODE_ENV === 'production',
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? '',
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? '',
  // SMTP Configuration
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  contactEmailTo: process.env.CONTACT_EMAIL_TO ?? '',
  contactEmailFrom: process.env.CONTACT_EMAIL_FROM ?? '',
};
