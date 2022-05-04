// Singleton S3 instance initialized on-demand.
import { S3 } from '@aws-sdk/client-s3';
import { parseUrl } from './url';

let s3Instance: S3 | undefined;
export function getS3Client(): S3 {
  if (!s3Instance) {
    s3Instance = new S3({});
  }
  return s3Instance;
}

export interface S3UrlParts {
  Bucket: string;
  Key: string;
}

export function parseS3Url(rawUrl: URL | string): S3UrlParts | null {
  const parsedUrl = typeof rawUrl === 'string' ? parseUrl(rawUrl) : rawUrl;
  if (parsedUrl === null) {
    return null;
  }
  if (parsedUrl.protocol !== 's3:') {
    return null;
  }
  return {
    Bucket: parsedUrl.host,
    Key: parsedUrl.pathname.substring(1),
  };
}
