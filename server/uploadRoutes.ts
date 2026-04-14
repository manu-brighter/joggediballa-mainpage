import { Router, Request, Response } from 'express';
import { storagePut } from './storage';
import { nanoid } from 'nanoid';
import sharp from 'sharp';

const router = Router();

// Helper function to parse multipart form data
function parseMultipartFormData(
  body: Buffer,
  contentType: string,
): { fileBuffer: Buffer | null; fileName: string; fileMimeType: string } {
  let fileBuffer: Buffer | null = null;
  let fileName = 'file.jpg';
  let fileMimeType = 'image/jpeg';

  // Extract boundary from content-type
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch) {
    return { fileBuffer: null, fileName, fileMimeType };
  }

  const boundary = boundaryMatch[1];
  const parts = body.toString('binary').split(`--${boundary}`);

  for (const part of parts) {
    if (part.includes('Content-Disposition') && part.includes('name="file"')) {
      // Extract filename
      const filenameMatch = part.match(/filename="([^"]+)"/);
      if (filenameMatch) {
        fileName = filenameMatch[1];
      }

      // Extract content type
      const mimeMatch = part.match(/Content-Type:\s*([^\r\n]+)/);
      if (mimeMatch) {
        fileMimeType = mimeMatch[1].trim();
      }

      // Extract file content (after double CRLF)
      const contentStart = part.indexOf('\r\n\r\n') + 4;
      const contentEnd = part.lastIndexOf('\r\n');
      if (contentStart > 3 && contentEnd > contentStart) {
        fileBuffer = Buffer.from(
          part.substring(contentStart, contentEnd),
          'binary',
        );
      }
    }
  }

  return { fileBuffer, fileName, fileMimeType };
}

// Profile picture upload
router.post('/profile-picture', async (req: Request, res: Response) => {
  try {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';

        if (!contentType.includes('multipart/form-data')) {
          res
            .status(400)
            .json({ error: 'Content-Type must be multipart/form-data' });
          return;
        }

        const { fileBuffer, fileName, fileMimeType } = parseMultipartFormData(
          body,
          contentType,
        );

        if (!fileBuffer) {
          res.status(400).json({ error: 'No file found in request' });
          return;
        }

        if (!fileMimeType.startsWith('image/')) {
          res.status(400).json({ error: 'Only image files are allowed' });
          return;
        }

        // Generate unique key
        const ext = fileName.split('.').pop() || 'jpg';
        const uniqueKey = `profile-pictures/${nanoid()}.${ext}`;

        // Upload to S3
        const { url, key } = await storagePut(
          uniqueKey,
          fileBuffer,
          fileMimeType,
        );

        res.json({ url, key });
      } catch (error) {
        console.error('Profile picture upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
      }
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Sponsor logo upload
router.post('/sponsor-logo', async (req: Request, res: Response) => {
  try {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';

        if (!contentType.includes('multipart/form-data')) {
          res
            .status(400)
            .json({ error: 'Content-Type must be multipart/form-data' });
          return;
        }

        const { fileBuffer, fileName, fileMimeType } = parseMultipartFormData(
          body,
          contentType,
        );

        if (!fileBuffer) {
          res.status(400).json({ error: 'No file found in request' });
          return;
        }

        // Validate file type (allow images)
        if (!fileMimeType.startsWith('image/')) {
          res.status(400).json({ error: 'Only image files are allowed' });
          return;
        }

        // Generate unique key
        const ext = fileName.split('.').pop() || 'png';
        const uniqueKey = `sponsors/${nanoid()}.${ext}`;

        // Upload to S3
        const { url, key } = await storagePut(
          uniqueKey,
          fileBuffer,
          fileMimeType,
        );

        res.json({ url, key });
      } catch (error) {
        console.error('Sponsor logo upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
      }
    });
  } catch (error) {
    console.error('Sponsor logo upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Event photo upload
router.post('/event-photo', async (req: Request, res: Response) => {
  try {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';

        if (!contentType.includes('multipart/form-data')) {
          res
            .status(400)
            .json({ error: 'Content-Type must be multipart/form-data' });
          return;
        }

        const { fileBuffer, fileName, fileMimeType } = parseMultipartFormData(
          body,
          contentType,
        );

        if (!fileBuffer) {
          res.status(400).json({ error: 'No file found in request' });
          return;
        }

        // Validate file type (allow images)
        if (!fileMimeType.startsWith('image/')) {
          res.status(400).json({ error: 'Only image files are allowed' });
          return;
        }

        // Generate unique ID for this photo
        const photoId = nanoid();
        const ext = fileName.split('.').pop() || 'jpg';

        // Upload original high-res image
        const originalKey = `events/original/${photoId}.${ext}`;
        const { url: originalUrl, key: originalStorageKey } = await storagePut(
          originalKey,
          fileBuffer,
          fileMimeType,
        );

        // Generate compressed version (for lightbox preview / medium quality)
        const compressedBuffer = await sharp(fileBuffer)
          .resize(1200, 1200, {
            // Max 1200px on longest side for lightbox
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 65 }) // Good quality for lightbox preview
          .toBuffer();

        // Upload compressed version
        const compressedKey = `events/compressed/${photoId}.jpg`;
        const { url: compressedUrl, key: compressedStorageKey } =
          await storagePut(compressedKey, compressedBuffer, 'image/jpeg');

        // Generate thumbnail (for gallery grid / event cards)
        const thumbnailBuffer = await sharp(fileBuffer)
          .resize(400, 400, {
            // Max 400px - small and fast for grids
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 60 }) // Balanced quality/size (~20-50KB)
          .toBuffer();

        // Upload thumbnail version
        const thumbnailKey = `events/thumbnails/${photoId}.jpg`;
        const { url: thumbnailUrl, key: thumbnailStorageKey } =
          await storagePut(thumbnailKey, thumbnailBuffer, 'image/jpeg');

        res.json({
          url: originalUrl,
          key: originalStorageKey,
          compressedUrl,
          compressedKey: compressedStorageKey,
          thumbnailUrl,
          thumbnailKey: thumbnailStorageKey,
        });
      } catch (error) {
        console.error('Event photo upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
      }
    });
  } catch (error) {
    console.error('Event photo upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Team member photo upload
router.post('/team-member-photo', async (req: Request, res: Response) => {
  try {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';

        if (!contentType.includes('multipart/form-data')) {
          res
            .status(400)
            .json({ error: 'Content-Type must be multipart/form-data' });
          return;
        }

        const { fileBuffer, fileName, fileMimeType } = parseMultipartFormData(
          body,
          contentType,
        );

        if (!fileBuffer) {
          res.status(400).json({ error: 'No file found in request' });
          return;
        }

        // Validate file type (allow images)
        if (!fileMimeType.startsWith('image/')) {
          res.status(400).json({ error: 'Only image files are allowed' });
          return;
        }

        // Generate unique ID for both versions
        const photoId = nanoid();
        const ext = fileName.split('.').pop() || 'jpg';

        // Upload original high-res image
        const originalKey = `team-members/original/${photoId}.${ext}`;
        const { url: originalUrl, key: originalStorageKey } = await storagePut(
          originalKey,
          fileBuffer,
          fileMimeType,
        );

        // Generate compressed version (max 512px, lower quality for faster loading)
        const compressedBuffer = await sharp(fileBuffer)
          .resize(512, 512, {
            // Max 512px on longest side
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 70 }) // Good quality JPEG
          .toBuffer();

        // Upload compressed version
        const compressedKey = `team-members/compressed/${photoId}.jpg`;
        const { url: compressedUrl, key: compressedStorageKey } =
          await storagePut(compressedKey, compressedBuffer, 'image/jpeg');

        res.json({
          url: originalUrl,
          key: originalStorageKey,
          compressedUrl,
          compressedKey: compressedStorageKey,
        });
      } catch (error) {
        console.error('Team member photo upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
      }
    });
  } catch (error) {
    console.error('Team member photo upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export { router as uploadRouter };
