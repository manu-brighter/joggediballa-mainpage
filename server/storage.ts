// Self-hosted file storage. Writes/reads/deletes files on local disk under
// UPLOAD_DIR (default /var/www/joggediballa-mainpage/uploads), which nginx
// serves at PUBLIC_UPLOAD_URL/<key> via the /uploads/ location.

import { promises as fs } from 'fs';
import * as path from 'path';

type StorageConfig = { uploadDir: string; publicUrl: string };

function getConfig(): StorageConfig {
  const uploadDir =
    process.env.UPLOAD_DIR || '/var/www/joggediballa-mainpage/uploads';
  const publicUrl =
    process.env.PUBLIC_UPLOAD_URL || 'https://joggediballa.ch/uploads';
  return { uploadDir, publicUrl };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, '');
}

function buildPublicUrl(publicUrl: string, key: string): string {
  return `${publicUrl.replace(/\/+$/, '')}/${key}`;
}

// B-P2-02 / F-BE-020: fs.promises (async) variants so request handlers don't
// block the event loop on disk I/O. mkdir({recursive: true}) is idempotent so
// we no longer need an existsSync probe before it. unlink is wrapped in a
// try/catch and we tolerate ENOENT (already gone) rather than stat-then-act.
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  // contentType is part of the public signature for compatibility with the
  // earlier S3-aware implementation; local writes don't need it (file
  // extension + nginx mime.types drive the served Content-Type instead).
  _contentType: string = 'application/octet-stream',
): Promise<{ key: string; url: string }> {
  const { uploadDir, publicUrl } = getConfig();
  const key = normalizeKey(relKey);
  const filePath = path.join(uploadDir, key);

  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const buffer =
    typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
  await fs.writeFile(filePath, buffer);

  return { key, url: buildPublicUrl(publicUrl, key) };
}

export async function storageGet(
  relKey: string,
): Promise<{ key: string; url: string }> {
  const { publicUrl } = getConfig();
  const key = normalizeKey(relKey);
  return { key, url: buildPublicUrl(publicUrl, key) };
}

export async function storageDelete(relKey: string): Promise<void> {
  if (!relKey) {
    console.warn('[Storage] Attempted to delete empty key, skipping');
    return;
  }

  const { uploadDir } = getConfig();
  const key = normalizeKey(relKey);
  const filePath = path.join(uploadDir, key);

  try {
    await fs.unlink(filePath);
  } catch (error: unknown) {
    // ENOENT (file already gone) is benign — treat as success silently.
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      return;
    }
    // Don't throw — we don't want to fail the entire delete operation if
    // storage cleanup fails (e.g. permissions glitch).
    console.error(`[Storage] Failed to delete file ${relKey}:`, error);
  }
}
