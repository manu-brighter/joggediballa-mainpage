import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import net from 'net';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { registerGoogleAuthRoutes } from './googleAuthRoutes';
import { appRouter } from '../routers';
import { createContext } from './context';
import { serveStatic, setupVite } from './vite';
import { uploadRouter } from '../uploadRoutes';
import sitemapRouter from '../sitemap';
import { ENV } from './env';

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Same-origin / x-trpc-source CSRF guard (A-P0-04 / F-SEC-005).
 *
 * For state-changing requests on `/api/*`, require ONE of:
 *   - an `Origin` header that matches `ENV.appOrigin` (the prod URL); OR
 *   - a custom `x-trpc-source` header (which CORS prevents browsers from
 *     setting cross-site without preflight; web client sends `web`).
 *
 * GETs and HEAD are allowed unconditionally — they must be side-effect-free.
 */
function csrfGuard(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const origin = req.headers.origin;
  const allowed = ENV.appOrigin;
  if (allowed && typeof origin === 'string' && origin === allowed) {
    return next();
  }

  // tRPC client sets this; CORS prevents browsers from forging it cross-site.
  if (req.headers['x-trpc-source']) {
    return next();
  }

  // Localhost dev convenience: Vite serves the SPA on a separate port. In
  // development we also accept any same-host Origin to avoid friction.
  if (!ENV.isProduction && typeof origin === 'string') {
    try {
      const u = new URL(origin);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        return next();
      }
    } catch {
      // fallthrough to reject
    }
  }

  console.warn(`[CSRF] Rejected ${method} ${req.path} (origin: ${origin})`);
  res.status(403).json({ error: 'CSRF check failed' });
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust proxy for Nginx reverse proxy (required for secure cookies behind proxy)
  app.set('trust proxy', 1);

  // Security headers (A-P1-04 / F-SEC-009).
  //   - script-src: prod = 'self' + googletagmanager (gated by user consent
  //     via the cookie banner — loaded on demand by client/src/_core/
  //     googleAnalytics.ts). Dev additionally allows 'unsafe-inline' +
  //     'unsafe-eval' because Vite injects an inline preamble for React Fast
  //     Refresh and the module loader uses eval-style imports.
  //   - style-src 'unsafe-inline' kept everywhere — recharts injects an inline
  //     <style> via dangerouslySetInnerHTML (follow-up: nonce).
  //   - font-src 'self' + data:  — Inter is self-hosted via
  //     @fontsource-variable/inter; no Google Fonts CDN allowed.
  //   - connect-src: 'self' + GA beacons (google-analytics.com,
  //     analytics.google.com). Dev adds ws/wss for the Vite HMR socket.
  //   - img-src allows Google avatars, GA pixel beacons, data:/blob:
  //     URLs for canvas previews, and the PUBLIC_UPLOAD_URL origin so
  //     locally-developed pages can load production-hosted user uploads
  //     (team-member photos, sponsor logos, event photos) since dev
  //     localhost is treated as a different origin than joggediballa.ch.
  //
  // HSTS: 2 years, includeSubDomains. `preload` left off (A-P2-02 review).
  const isDev = process.env.NODE_ENV !== 'production';

  // Extract the scheme+host of PUBLIC_UPLOAD_URL so user uploads served from
  // the prod CDN/nginx are allowed by img-src in any environment.
  const publicUploadOrigin = (() => {
    try {
      return process.env.PUBLIC_UPLOAD_URL
        ? new URL(process.env.PUBLIC_UPLOAD_URL).origin
        : null;
    } catch {
      return null;
    }
  })();

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isDev
            ? [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                'https://www.googletagmanager.com',
              ]
            : [
                "'self'",
                // SHA-256 of the inline anti-FOUC theme <script> in
                // client/index.html (its exact text content). Without this the
                // strict prod CSP blocks it, so the pre-paint theme class never
                // applies and the first paint flashes the wrong mode. Dev uses
                // 'unsafe-inline' above so the hash isn't needed there.
                // Regenerate if that inline script changes (whitespace counts):
                //   node -e "const c=require('fs').readFileSync('client/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];console.log('sha256-'+require('crypto').createHash('sha256').update(c).digest('base64'))"
                "'sha256-UanIoWyb2dXLZpX3XVDrdZLEmef4iNrjZncOwS1HKSE='",
                'https://www.googletagmanager.com',
              ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://lh3.googleusercontent.com',
            'https://www.google-analytics.com',
            'https://*.google-analytics.com',
            ...(publicUploadOrigin ? [publicUploadOrigin] : []),
          ],
          connectSrc: isDev
            ? [
                "'self'",
                'ws:',
                'wss:',
                'https://www.google-analytics.com',
                'https://*.google-analytics.com',
                'https://*.analytics.google.com',
              ]
            : [
                "'self'",
                'https://www.google-analytics.com',
                'https://*.google-analytics.com',
                'https://*.analytics.google.com',
              ],
          fontSrc: ["'self'", 'data:'],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 63072000, // 2 years
        includeSubDomains: true,
        preload: false,
      },
    }),
  );

  // -----------------------------------------------------------------------
  // Rate limiting (A-P0-07 / F-SEC-008).
  // The original config skipped ALL /api/trpc traffic, leaving contact.send
  // and harassenlauf.register fully unthrottled. The new policy:
  //   - GET requests to /api/trpc (queries) bypass — these legitimately poll
  //     (shotcounter overlay every 1-2s; the limit would lock out users).
  //   - POST requests to /api/trpc (mutations) are subject to a tighter,
  //     per-IP limit. This is the simplest layer that defends contact.send
  //     and harassenlauf.register at the Express boundary; per-procedure
  //     limits could be added later as tRPC middleware.
  //   - All non-tRPC routes (auth, uploads, static) keep the existing 300-req
  //     per-IP window.
  // -----------------------------------------------------------------------
  // In production, both limiters enforce per-IP windows. In dev/test the
  // limits are off so HMR reloads, Playwright suites, and manual refreshes
  // don't trip 429s. Production behavior is unchanged.
  const skipInNonProd = (): boolean => process.env.NODE_ENV !== 'production';

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: req => skipInNonProd() || req.path.startsWith('/api/trpc'),
  });
  app.use(generalLimiter);

  const trpcMutationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60, // 60 mutations / 15 min / IP — well above normal use
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: req => skipInNonProd() || req.method.toUpperCase() === 'GET',
  });

  // Body parsing — file uploads use multipart (not JSON), so 1 MB is sufficient here
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // Google OAuth is the only supported auth flow.
  registerGoogleAuthRoutes(app);

  // CSRF guard runs before any tRPC mutation or /api/upload write.
  app.use('/api/trpc', csrfGuard, trpcMutationLimiter);
  app.use('/api/upload', csrfGuard);

  // tRPC API
  app.use(
    '/api/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // File upload routes
  app.use('/api/upload', uploadRouter);

  // Sitemap route
  app.use(sitemapRouter);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || '3000');
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
