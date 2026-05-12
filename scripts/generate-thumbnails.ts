/**
 * generate-thumbnails.ts
 *
 * One-shot migration script: generates 400px JPEG thumbnails for every photo
 * row that still has a NULL thumbnailUrl.
 *
 * Pipeline:
 *   DB photos lacking thumbnailUrl
 *     → download compressedUrl|imageUrl
 *     → sharp resize 400px / JPEG q60
 *     → write to UPLOAD_DIR/events/thumbnails/<nanoid>.jpg
 *     → UPDATE photos SET thumbnailUrl, thumbnailKey
 *
 * Run on the server:
 *   cd /var/www/joggediballa-mainpage
 *   pnpm tsx scripts/generate-thumbnails.ts
 *
 * Env vars (loaded via dotenv): DATABASE_URL, UPLOAD_DIR, PUBLIC_UPLOAD_URL.
 */

import 'dotenv/config';
import sharp from 'sharp';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, isNull } from 'drizzle-orm';
import { photos } from '../drizzle/schema.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Storage helper — writes to self-hosted disk (mirrors server/storage.ts).
// ---------------------------------------------------------------------------

async function storagePut(
  relKey: string,
  data: Buffer,
): Promise<{ key: string; url: string }> {
  const uploadDir =
    process.env.UPLOAD_DIR || '/var/www/joggediballa-mainpage/uploads';
  const publicUrl =
    process.env.PUBLIC_UPLOAD_URL || 'https://joggediballa.ch/uploads';

  const key = relKey.replace(/^\/+/, '');
  const filePath = path.join(uploadDir, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
  const url = `${publicUrl.replace(/\/+$/, '')}/${key}`;
  return { key, url };
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL nicht gesetzt. Bitte .env prüfen.');
    process.exit(1);
  }

  console.log('🔌 Verbinde mit Datenbank...');
  const db = drizzle(dbUrl);

  // Alle Fotos ohne thumbnailUrl laden
  const photosWithoutThumbnail = await db
    .select()
    .from(photos)
    .where(isNull(photos.thumbnailUrl));

  const total = photosWithoutThumbnail.length;
  console.log(`📸 ${total} Fotos ohne Thumbnail gefunden.\n`);

  if (total === 0) {
    console.log('✅ Alle Fotos haben bereits Thumbnails. Nichts zu tun.');
    process.exit(0);
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const photo = photosWithoutThumbnail[i];
    const progress = `[${i + 1}/${total}]`;

    // Prefer compressed version as source (smaller download)
    const sourceUrl = photo.compressedUrl || photo.imageUrl;

    try {
      console.log(
        `${progress} Lade Foto #${photo.id} von ${sourceUrl.substring(0, 80)}...`,
      );

      // 1. Download source image
      const imageBuffer = await downloadImage(sourceUrl);

      // 2. Generate thumbnail with sharp
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(400, 400, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 60 })
        .toBuffer();

      const sizeKB = (thumbnailBuffer.length / 1024).toFixed(1);

      // 3. Upload thumbnail
      const thumbId = nanoid();
      const thumbnailKey = `events/thumbnails/${thumbId}.jpg`;
      const { url: thumbnailUrl, key: storedKey } = await storagePut(
        thumbnailKey,
        thumbnailBuffer,
      );

      // 4. Update database
      await db
        .update(photos)
        .set({
          thumbnailUrl,
          thumbnailKey: storedKey,
        })
        .where(eq(photos.id, photo.id));

      console.log(`${progress} ✅ Foto #${photo.id} → Thumbnail ${sizeKB}KB`);
      success++;
    } catch (error: any) {
      console.error(
        `${progress} ❌ Foto #${photo.id} fehlgeschlagen: ${error.message}`,
      );
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(
    `📊 Ergebnis: ${success} erfolgreich, ${failed} fehlgeschlagen (von ${total})`,
  );
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('💥 Unerwarteter Fehler:', err);
  process.exit(1);
});
