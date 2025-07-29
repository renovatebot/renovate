// Singleton S3 instance initialized on-demand.
import { Storage } from '@google-cloud/storage';
import { GlobalConfig } from '../config/global';
import { parseUrl } from './url';

let gcsInstance: Storage | undefined;
export function getGcsClient(): Storage {
  gcsInstance ??= new Storage({
    apiEndpoint: GlobalConfig.get('gcsEndpoint'),
  });

  return gcsInstance;
}

export interface GcsUrlParts {
  bucket: string;
  pathname: string;
}

export function parseGcsUrl(rawUrl: URL | string): GcsUrlParts | null {
  const parsedUrl = typeof rawUrl === 'string' ? parseUrl(rawUrl) : rawUrl;

  if (parsedUrl?.protocol !== 'gs:') {
    return null;
  }

  return {
    bucket: parsedUrl.host,
    pathname: parsedUrl.pathname.substring(1),
  };
}
