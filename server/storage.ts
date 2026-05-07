// Self-hosted file storage. Earlier versions branched on a SELF_HOSTED_STORAGE
// env-var to choose between local disk and a Manus S3 proxy (gated by the
// BUILT_IN_FORGE_API_URL/KEY pair). The S3 path was never used in production
// and has been removed; this module now writes/reads/deletes files on local
// disk under UPLOAD_DIR (default /var/www/joggediballa-mainpage/uploads),
// which nginx serves at PUBLIC_UPLOAD_URL/<key> via the /uploads/ location.

import * as fs from 'fs';
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
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const buffer =
    typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

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

  try {
    const { uploadDir } = getConfig();
    const key = normalizeKey(relKey);
    const filePath = path.join(uploadDir, key);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Storage] Deleted local file: ${filePath}`);
    } else {
      console.warn(`[Storage] File not found for deletion: ${filePath}`);
    }
  } catch (error) {
    // Don't throw — we don't want to fail the entire delete operation if
    // storage cleanup fails (e.g. file already gone, permissions glitch).
    console.error(`[Storage] Failed to delete file ${relKey}:`, error);
  }
}
