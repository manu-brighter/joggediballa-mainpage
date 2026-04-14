// Preconfigured storage helpers for Manus WebDev templates
// Supports both Manus S3 proxy and self-hosted local storage

import { ENV } from './_core/env';
import * as fs from 'fs';
import * as path from 'path';

type StorageConfig = { baseUrl: string; apiKey: string };

// Check if self-hosted storage is enabled
function isSelfHosted(): boolean {
  return process.env.SELF_HOSTED_STORAGE === 'true';
}

function getSelfHostedConfig(): { uploadDir: string; publicUrl: string } {
  const uploadDir =
    process.env.UPLOAD_DIR || '/var/www/joggediballa-mainpage/uploads';
  const publicUrl =
    process.env.PUBLIC_UPLOAD_URL || 'https://joggediballa.ch/uploads';
  return { uploadDir, publicUrl };
}

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      'Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY',
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL('v1/storage/upload', ensureTrailingSlash(baseUrl));
  url.searchParams.set('path', normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string,
): Promise<string> {
  const downloadApiUrl = new URL(
    'v1/storage/downloadUrl',
    ensureTrailingSlash(baseUrl),
  );
  downloadApiUrl.searchParams.set('path', normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: 'GET',
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, '');
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string,
): FormData {
  const blob =
    typeof data === 'string'
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append('file', blob, fileName || 'file');
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

// Self-hosted storage implementation
async function storagePutLocal(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream',
): Promise<{ key: string; url: string }> {
  const { uploadDir, publicUrl } = getSelfHostedConfig();
  const key = normalizeKey(relKey);
  const filePath = path.join(uploadDir, key);

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  const buffer =
    typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

  // Build public URL
  const url = `${publicUrl.replace(/\/+$/, '')}/${key}`;

  return { key, url };
}

async function storageGetLocal(
  relKey: string,
): Promise<{ key: string; url: string }> {
  const { publicUrl } = getSelfHostedConfig();
  const key = normalizeKey(relKey);
  const url = `${publicUrl.replace(/\/+$/, '')}/${key}`;
  return { key, url };
}

// Manus S3 storage implementation
async function storagePutS3(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream',
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split('/').pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`,
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

async function storageGetS3(
  relKey: string,
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

// Exported functions - automatically choose storage backend
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream',
): Promise<{ key: string; url: string }> {
  if (isSelfHosted()) {
    return storagePutLocal(relKey, data, contentType);
  }
  return storagePutS3(relKey, data, contentType);
}

export async function storageGet(
  relKey: string,
): Promise<{ key: string; url: string }> {
  if (isSelfHosted()) {
    return storageGetLocal(relKey);
  }
  return storageGetS3(relKey);
}

// Delete file from storage
async function storageDeleteLocal(relKey: string): Promise<void> {
  const { uploadDir } = getSelfHostedConfig();
  const key = normalizeKey(relKey);
  const filePath = path.join(uploadDir, key);

  // Check if file exists before deleting
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`[Storage] Deleted local file: ${filePath}`);
  } else {
    console.warn(`[Storage] File not found for deletion: ${filePath}`);
  }
}

async function storageDeleteS3(relKey: string): Promise<void> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);

  const deleteUrl = new URL('v1/storage/delete', ensureTrailingSlash(baseUrl));
  deleteUrl.searchParams.set('path', key);

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: buildAuthHeaders(apiKey),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    console.error(
      `[Storage] S3 delete failed (${response.status}): ${message}`,
    );
    throw new Error(
      `Storage delete failed (${response.status} ${response.statusText}): ${message}`,
    );
  }

  console.log(`[Storage] Deleted S3 file: ${key}`);
}

export async function storageDelete(relKey: string): Promise<void> {
  if (!relKey) {
    console.warn('[Storage] Attempted to delete empty key, skipping');
    return;
  }

  try {
    if (isSelfHosted()) {
      await storageDeleteLocal(relKey);
    } else {
      await storageDeleteS3(relKey);
    }
  } catch (error) {
    console.error(`[Storage] Failed to delete file ${relKey}:`, error);
    // Don't throw - we don't want to fail the entire delete operation if storage cleanup fails
  }
}
