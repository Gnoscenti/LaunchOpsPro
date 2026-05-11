// Local file-based storage for self-hosted Founder Edition
// Replaces the Manus storage proxy with local filesystem storage
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';

const STORAGE_DIR = process.env.FOUNDER_EDITION_DIR
  ? join(process.env.FOUNDER_EDITION_DIR, 'artifacts')
  : '/opt/launchops/artifacts';

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const filePath = join(STORAGE_DIR, key);
  
  // Ensure directory exists
  await mkdir(dirname(filePath), { recursive: true });
  
  // Write file
  if (typeof data === 'string') {
    await writeFile(filePath, data, 'utf-8');
  } else {
    await writeFile(filePath, data);
  }
  
  // Return a local URL (accessible via the platform server)
  const url = `/artifacts/${key}`;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return {
    key,
    url: `/artifacts/${key}`,
  };
}
