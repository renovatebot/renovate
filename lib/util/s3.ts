// Singleton S3 instance initialized on-demand.
import { S3 } from '@aws-sdk/client-s3';
import { parseUrl } from './url';

let s3Instance: S3 | undefined;
export function getS3Client(): S3 {
  if (!s3Instance) {
    const endpoint = process.env.RENOVATE_X_S3_ENDPOINT;
    const forcePathStyle = process.env.RENOVATE_X_S3_PATH_STYLE;
    s3Instance = new S3({
      ...(endpoint && { endpoint }),
      ...(forcePathStyle && { forcePathStyle: true }),
    });
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
