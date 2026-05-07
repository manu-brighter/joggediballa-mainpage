import { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';
import { ForbiddenError } from '@shared/_core/errors';
import { parse as parseCookieHeader } from 'cookie';
import type { Request } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import type { User } from '../../drizzle/schema';
import * as db from '../db';
import { ENV } from './env';

// Auth utilities for the Google OAuth flow. The original module also wrapped
// a Manus.im OAuth client (exchangeCodeForToken / getUserInfoWithJwt / …);
// that path was removed once we committed to Google OAuth as the only flow.
// What remains here are the JWT primitives used by tRPC context creation.

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

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
   * Sign a JWT session payload. Used by ad-hoc code paths that need to
   * mint sessions outside the normal Google callback (which signs its
   * own JWT directly in googleAuthRoutes.ts).
   */
  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || '',
      },
      options,
    );
  }

  /**
   * Verify a session JWT (signed either by signSession above or by the
   * Google callback in googleAuthRoutes.ts — both use the same secret
   * and the same {openId, appId, name} shape).
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
