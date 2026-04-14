/**
 * generate-thumbnails.ts
 *
 * Einmaliges Migrations-Script: Generiert Thumbnails für alle bestehenden Fotos
 * die noch kein thumbnailUrl haben.
 *
 * Funktionsweise:
 * 1. Alle Fotos aus der DB laden die kein thumbnailUrl haben
 * 2. Für jedes Foto: compressedUrl oder imageUrl herunterladen
 * 3. Mit sharp auf 400px verkleinern (JPEG q60)
 * 4. Thumbnail in Storage hochladen (self-hosted oder S3)
 * 5. DB-Eintrag mit thumbnailUrl und thumbnailKey updaten
 *
 * Ausführung auf dem Server:
 *   cd /var/www/joggediballa-mainpage
 *   npx tsx scripts/generate-thumbnails.ts
 *
 * Oder mit pnpm:
 *   pnpm tsx scripts/generate-thumbnails.ts
 *
 * Umgebungsvariablen werden aus .env geladen (dotenv).
 */

import 'dotenv/config';
import sharp from 'sharp';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, isNull } from 'drizzle-orm';
import { photos } from '../drizzle/schema.js';
import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Storage helpers (copied/simplified from server/storage.ts to be standalone)
// ---------------------------------------------------------------------------

function isSelfHosted(): boolean {
  return process.env.SELF_HOSTED_STORAGE === 'true';
}

function getSelfHostedConfig() {
  const uploadDir =
    process.env.UPLOAD_DIR || '/var/www/joggediballa-mainpage/uploads';
  const publicUrl =
    process.env.PUBLIC_UPLOAD_URL || 'https://joggediballa.ch/uploads';
  return { uploadDir, publicUrl };
}

async function storagePut(
  relKey: string,
  data: Buffer,
  contentType = 'image/jpeg',
): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, '');

  if (isSelfHosted()) {
    const { uploadDir, publicUrl } = getSelfHostedConfig();
    const filePath = path.join(uploadDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data);
    const url = `${publicUrl.replace(/\/+$/, '')}/${key}`;
    return { key, url };
  } else {
    // S3 via Manus forge proxy
    const baseUrl = (process.env.BUILT_IN_FORGE_API_URL || '').replace(
      /\/+$/,
      '',
    );
    const apiKey = process.env.BUILT_IN_FORGE_API_KEY || '';
    if (!baseUrl || !apiKey) throw new Error('S3 credentials missing');

    const uploadUrl = new URL('v1/storage/upload', baseUrl + '/');
    uploadUrl.searchParams.set('path', key);

    const blob = new Blob([new Uint8Array(data)], { type: contentType });
    const form = new FormData();
    form.append('file', blob, key.split('/').pop() ?? 'thumb.jpg');

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const msg = await response.text().catch(() => response.statusText);
      throw new Error(`Upload failed (${response.status}): ${msg}`);
    }
    const url = (await response.json()).url;
    return { key, url };
  }
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
        'image/jpeg',
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
