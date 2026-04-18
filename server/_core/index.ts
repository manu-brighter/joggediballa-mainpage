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
  // (Google Analytics, S3 URLs, OAuth). Enable and configure once origins are stable.
  app.use(
    helmet({
      contentSecurityPolicy: false,
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

  // OAuth routes - use Google OAuth for self-hosting or Manus OAuth for Manus platform
  if (process.env.GOOGLE_CLIENT_ID) {
    console.log('[Auth] Using Google OAuth for authentication');
    registerGoogleAuthRoutes(app);
  } else {
    console.log('[Auth] Using Manus OAuth for authentication');
    // Dynamic import prevents Manus SDK from initializing when Google OAuth is active
    const { registerOAuthRoutes } = await import('./oauth');
    registerOAuthRoutes(app);
  }
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
