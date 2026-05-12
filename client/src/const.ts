export { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';

/** Login URL for Google OAuth (function form for callsite stability). */
export const getLoginUrl = (): string => '/api/auth/google';
