import type { Storage } from '@google-cloud/storage';
import { isString } from '@sindresorhus/is';
import { parseUrl } from './url.ts';

let gcsInstance: Storage | undefined;

export async function getGCSClient(): Promise<Storage> {
  if (!gcsInstance) {
    const { Storage: GCSStorage } = await import('@google-cloud/storage');
    gcsInstance ??= new GCSStorage();
  }
  return gcsInstance;
}

export interface GCSUrlParts {
  bucket: string;
  pathname: string;
}

export function parseGCSUrl(rawUrl: URL | string): GCSUrlParts | null {
  const parsedUrl = isString(rawUrl) ? parseUrl(rawUrl) : rawUrl;
  if (parsedUrl === null) {
    return null;
  }
  if (parsedUrl.protocol !== 'gs:') {
    return null;
  }
  return {
    bucket: parsedUrl.host,
    pathname: parsedUrl.pathname.substring(1),
  };
}
