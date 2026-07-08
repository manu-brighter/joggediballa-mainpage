/**
 * Upload routes — fully rewritten (Phase 3b, A-P0-03).
 *
 * Previously this file rolled its own multipart parser and accepted unauthenticated
 * uploads with no size cap, no MIME sniff, no decompression-bomb defence, and
 * no path-traversal handling. The new implementation:
 *
 *   - Uses `multer` (memory storage) with strict size + file-count caps.
 *   - Requires a logged-in user with role >= editor on every route.
 *   - Validates uploads with `sharp.metadata()` — sharp throws on non-image
 *     bytes, so this doubles as a magic-byte sniff. We only accept
 *     image/jpeg, image/png, image/webp.
 *   - Pixel cap (`limitInputPixels`) prevents PNG decompression-bomb DoS.
 *   - Generates filenames server-side via `nanoid()` + sniffed extension —
 *     the client name is never written to disk.
 *
 * The four upload routes share one handler factory.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import rateLimit from 'express-rate-limit';
import { parse as parseCookieHeader } from 'cookie';
import { jwtVerify } from 'jose';
import { COOKIE_NAME } from '../shared/const';
import { ENV, getJwtSecretBytes } from './_core/env';
import { storagePut } from './storage';
import {
  getUserByOpenId,
  getSlideshowSettings,
  getSlideshowStats,
  createSlideshowPhoto,
  bumpPhotoVersion,
} from './db';

// ---------------------------------------------------------------------------
// Auth middleware — JWT cookie verification at the Express layer.
// Mirrors server/_core/sdk.ts but adapted for Express (the tRPC context helper
// expects the tRPC pipeline). Kept tiny on purpose.
// ---------------------------------------------------------------------------

type AuthedUser = {
  id: number;
  role: 'admin' | 'maintainer' | 'editor' | 'user' | 'visitor';
};

type AuthedRequest = Request & { authUser?: AuthedUser };

const EDITOR_ROLES = new Set(['admin', 'maintainer', 'editor']);

async function requireAuthExpress(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const cookies = parseCookieHeader(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { payload } = await jwtVerify(token, getJwtSecretBytes(), {
      algorithms: ['HS256'],
    });
    const openId = (payload as Record<string, unknown>).openId;
    if (typeof openId !== 'string' || openId.length === 0) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    const user = await getUserByOpenId(openId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    if (!EDITOR_ROLES.has(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    (req as AuthedRequest).authUser = { id: user.id, role: user.role };
    next();
  } catch (err) {
    console.warn('[Upload] Auth failed:', String(err));
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// ---------------------------------------------------------------------------
// Multer config — memory storage, hard size & file-count caps.
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ENV.uploadMaxBytes,
    files: 1,
    fields: 4,
  },
});

// ---------------------------------------------------------------------------
// Validation — sharp.metadata() doubles as magic-byte sniff. We never trust
// the client-provided MIME or filename.
// ---------------------------------------------------------------------------

type SniffedImage = {
  buffer: Buffer;
  ext: 'jpg' | 'png' | 'webp';
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
};

// Decompression-bomb ceiling. Anything above this is rejected outright (a
// legit photo never approaches it — 120 MP covers pro medium-format bodies).
// Doubles as sharp's `limitInputPixels` so a crafted image can't blow up memory
// during decode. Legit-but-large photos (e.g. 31 MP Sony) pass here and are
// downscaled by the resize variants below.
const MAX_PIXELS = 120_000_000;

async function sniffImage(buf: Buffer): Promise<SniffedImage | null> {
  try {
    const meta = await sharp(buf, { limitInputPixels: MAX_PIXELS }).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (!w || !h) return null;
    if (w * h > MAX_PIXELS) return null;

    switch (meta.format) {
      case 'jpeg':
      case 'jpg':
        return { buffer: buf, ext: 'jpg', mime: 'image/jpeg', width: w, height: h };
      case 'png':
        return { buffer: buf, ext: 'png', mime: 'image/png', width: w, height: h };
      case 'webp':
        return { buffer: buf, ext: 'webp', mime: 'image/webp', width: w, height: h };
      default:
        return null; // rejects svg, gif, avif, heic, tiff, …
    }
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handler factory — every route reduces to:
//   router.post(path, requireAuthExpress, upload.single('file'), make(...))
// ---------------------------------------------------------------------------

type Variant = {
  prefix: string; // S3 key prefix, e.g. 'events/compressed'
  resize?: { w: number; h: number; quality: number }; // omitted = original
  forceJpeg?: boolean; // resize variants are always JPEG
};

type RouteSpec = {
  /** What the response field names look like; first variant is `url`/`key`. */
  variants: { name: string; spec: Variant }[];
};

function makeUploadHandler(spec: RouteSpec) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided (field name: "file")' });
        return;
      }

      const sniffed = await sniffImage(req.file.buffer);
      if (!sniffed) {
        res
          .status(415)
          .json({ error: 'Unsupported or invalid image (JPEG/PNG/WebP only)' });
        return;
      }

      const photoId = nanoid();
      const results: Record<string, string> = {};

      for (const v of spec.variants) {
        let buffer: Buffer = sniffed.buffer;
        let mime: string = sniffed.mime;
        let ext: string = sniffed.ext;

        if (v.spec.resize) {
          buffer = await sharp(sniffed.buffer, { limitInputPixels: MAX_PIXELS })
            // .rotate() with no args = bake in EXIF orientation, then sharp
            // drops metadata (incl. GPS) on encode. Without it, portrait
            // phone/camera shots would be stored sideways.
            .rotate()
            .resize(v.spec.resize.w, v.spec.resize.h, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: v.spec.resize.quality, mozjpeg: true })
            .toBuffer();
          mime = 'image/jpeg';
          ext = 'jpg';
        }

        const key = `${v.spec.prefix}/${photoId}.${ext}`;
        const { url, key: storageKey } = await storagePut(key, buffer, mime);

        if (v.name === 'original') {
          results.url = url;
          results.key = storageKey;
        } else {
          results[`${v.name}Url`] = url;
          results[`${v.name}Key`] = storageKey;
        }
      }

      res.json(results);
    } catch (error) {
      console.error('[Upload] Handler failed:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  };
}

// ---------------------------------------------------------------------------
// Multer error → JSON.
// ---------------------------------------------------------------------------

function multerErrorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res
        .status(413)
        .json({ error: `File exceeds ${ENV.uploadMaxBytes} byte limit` });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
}

// ---------------------------------------------------------------------------
// Routes — all auth-gated, all using the shared handler factory.
// ---------------------------------------------------------------------------

const router = Router();

router.post(
  '/profile-picture',
  requireAuthExpress,
  upload.single('file'),
  makeUploadHandler({
    variants: [{ name: 'original', spec: { prefix: 'profile-pictures' } }],
  }),
);

router.post(
  '/sponsor-logo',
  requireAuthExpress,
  upload.single('file'),
  makeUploadHandler({
    variants: [{ name: 'original', spec: { prefix: 'sponsors' } }],
  }),
);

router.post(
  '/event-photo',
  requireAuthExpress,
  upload.single('file'),
  makeUploadHandler({
    variants: [
      {
        // "original" is the HD image the lightbox loads on demand. We cap it at
        // 4096 px longest edge (> 4K) at high quality instead of storing the
        // raw camera file — keeps it razor-sharp while turning a 31 MP / 20 MB
        // upload into ~11 MP / ~4 MB. Bump this constant if you want more res.
        name: 'original',
        spec: {
          prefix: 'events/original',
          resize: { w: 4096, h: 4096, quality: 90 },
        },
      },
      {
        name: 'compressed',
        spec: {
          prefix: 'events/compressed',
          resize: { w: 1200, h: 1200, quality: 65 },
        },
      },
      {
        name: 'thumbnail',
        spec: {
          prefix: 'events/thumbnails',
          resize: { w: 400, h: 400, quality: 60 },
        },
      },
    ],
  }),
);

router.post(
  '/team-member-photo',
  requireAuthExpress,
  upload.single('file'),
  makeUploadHandler({
    variants: [
      { name: 'original', spec: { prefix: 'team-members/original' } },
      {
        name: 'compressed',
        spec: {
          prefix: 'team-members/compressed',
          resize: { w: 512, h: 512, quality: 70 },
        },
      },
    ],
  }),
);

// ---------------------------------------------------------------------------
// Public guest upload for the live slideshow. NO auth — gated by token +
// rate limit. Same-origin POST passes csrfGuard (Origin === appOrigin / same
// host in dev). All-in-one: validate -> sharp -> store -> DB insert. Low orphan
// risk — stored files may be left if the DB insert fails (acceptable here).
// Limit is DB-configurable (slideshowSettings.uploadRateLimit).
// ---------------------------------------------------------------------------

const slideshowUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: async () => {
    try {
      const s = await getSlideshowSettings();
      return s.uploadRateLimit;
    } catch {
      return 80;
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Uploads. Bitte einen Moment warten.' },
});

router.post(
  '/slideshow-photo',
  slideshowUploadLimiter,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const token =
        (typeof req.query.token === 'string' ? req.query.token : '') ||
        (typeof req.body?.token === 'string' ? req.body.token : '');
      const settings = await getSlideshowSettings();
      if (!token || token !== settings.uploadToken) {
        res.status(403).json({ error: 'Ungültiger Link' });
        return;
      }
      if (!settings.uploadsOpen) {
        res.status(423).json({ error: 'Uploads sind aktuell geschlossen' });
        return;
      }
      const stats = await getSlideshowStats();
      if (stats.pending + stats.approved >= settings.maxPhotos) {
        res.status(409).json({ error: 'Das Album ist voll' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No file provided (field name: "file")' });
        return;
      }
      const sniffed = await sniffImage(req.file.buffer);
      if (!sniffed) {
        res.status(415).json({ error: 'Ungültiges Bild (nur JPEG/PNG/WebP)' });
        return;
      }

      const id = nanoid();
      // .rotate() ohne Args = EXIF-Auto-Orientierung, dann EXIF/GPS gestrippt.
      // resolveWithObject liefert die finalen Dimensionen aus der Encode-
      // Pipeline — kein zweiter Decode des Display-Buffers nötig.
      const { data: displayBuf, info: displayInfo } = await sharp(sniffed.buffer, {
        limitInputPixels: MAX_PIXELS,
      })
        .rotate()
        .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      const thumbBuf = await sharp(sniffed.buffer, {
        limitInputPixels: MAX_PIXELS,
      })
        .rotate()
        .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 55 })
        .toBuffer();

      const display = await storagePut(
        `slideshow/display/${id}.jpg`,
        displayBuf,
        'image/jpeg',
      );
      const thumb = await storagePut(
        `slideshow/thumb/${id}.jpg`,
        thumbBuf,
        'image/jpeg',
      );

      const status: 'pending' | 'approved' = settings.moderationEnabled
        ? 'pending'
        : 'approved';
      const photoId = await createSlideshowPhoto({
        status,
        displayUrl: display.url,
        displayKey: display.key,
        thumbnailUrl: thumb.url,
        thumbnailKey: thumb.key,
        width: displayInfo.width,
        height: displayInfo.height,
        bytes: displayBuf.length,
        uploaderIp: req.ip ?? null,
      });
      if (status === 'approved') await bumpPhotoVersion();

      res.json({
        status: status === 'approved' ? 'live' : 'pending',
        id: photoId,
      });
    } catch (error) {
      console.error('[Upload] slideshow-photo failed:', error);
      res.status(500).json({ error: 'Upload fehlgeschlagen' });
    }
  },
);

router.use(multerErrorMiddleware);

export { router as uploadRouter };
