import { COOKIE_NAME } from '@shared/const';
import { ForbiddenError } from '@shared/_core/errors';
import { parse as parseCookieHeader } from 'cookie';
import type { Request } from 'express';
import { jwtVerify } from 'jose';
import type { User } from '../../drizzle/schema';
import * as db from '../db';
import { ENV } from './env';

// JWT verification + tRPC-context user lookup, used by createContext below.
// Sessions are MINTED in server/_core/googleAuthRoutes.ts (the Google OAuth
// callback signs its own JWT with `appId: 'google-oauth'`); this module is
// the verify side. Earlier versions exported a sign side too (signSession,
// createSessionToken) for the Manus OAuth flow that has since been removed.

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  /**
   * Verify a session JWT signed by googleAuthRoutes.ts. Returns the payload
   * `{ openId, appId, name }` or null if the token is missing, expired, or
   * its payload doesn't carry the expected non-empty fields.
   */
  async verifySession(
    cookieValue: string | undefined | null,
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn('[Auth] Missing session cookie');
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ['HS256'],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn('[Auth] Session payload missing required fields');
        return null;
      }

      return { openId, appId, name };
    } catch (error) {
      console.warn('[Auth] Session verification failed', String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError('Invalid session cookie');
    }

    // The Google OAuth callback (server/_core/googleAuth.ts) upserts the
    // user before issuing the JWT, so this miss should only be reachable
    // for a JWT whose owner has been deleted from the DB.
    const user = await db.getUserByOpenId(session.openId);
    if (!user) {
      throw ForbiddenError('User not found');
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: new Date(),
    });

    return user;
  }
}

export const sdk = new SDKServer();
