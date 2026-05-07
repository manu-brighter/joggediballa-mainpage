import 'dotenv/config';
import express from 'express';
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

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust proxy for Nginx reverse proxy (required for secure cookies behind proxy)
  app.set('trust proxy', 1);

  // Security headers — must come before all routes.
  // CSP is disabled here because it requires careful per-origin configuration
  // (Google OAuth popup origins, /uploads/, etc.). Enable and configure once
  // origins are stable.
  // HSTS bumped to 2 years + preload-eligible to match the manuelheller.dev
  // origin's nginx-level HSTS header. The site is HTTPS-only behind Cloudflare;
  // committing browsers to HTTPS for the joggediballa.ch + every subdomain is
  // safe — nothing here serves plain HTTP.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: {
        maxAge: 63072000, // 2 years
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // Rate limiter for non-tRPC routes (auth, upload, static assets).
  // tRPC is excluded because the overlay/shotcounter pages poll every 1-2s legitimately,
  // which would exhaust a per-IP limit and block unrelated pages for the same user.
  // Abuse prevention for sensitive tRPC procedures (e.g. contact.send) must be
  // implemented as tRPC middleware instead.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: req => req.path.startsWith('/api/trpc'),
    }),
  );

  // Body parsing — file uploads use multipart (not JSON), so 1 MB is sufficient here
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // Google OAuth is the only supported auth flow. The original Manus OAuth
  // integration (server/_core/oauth.ts + the Manus methods on the sdk
  // singleton) was removed once it was clear we'd never run on the Manus
  // platform — the auto-fall-back was the only consumer of OAUTH_SERVER_URL.
  registerGoogleAuthRoutes(app);
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
