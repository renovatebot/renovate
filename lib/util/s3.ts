// Singleton S3 instance initialized on-demand.
import { S3Client } from '@aws-sdk/client-s3';
import is from '@sindresorhus/is';
import { GlobalConfig } from '../config/global';
import { parseUrl } from './url';

let s3Instance: S3Client | undefined;
export function getS3Client(
  // Only needed if GlobalConfig is not initialized due to some error
  s3Endpoint?: string,
  s3PathStyle?: boolean,
  accessKeyId?: string,
  secretAccessKey?: string,
): S3Client {
  if (!s3Instance || accessKeyId || secretAccessKey) {
    // If credentials are provided, always create a new instance (do not cache globally)
    const endpoint = s3Endpoint ?? GlobalConfig.get('s3Endpoint');
    const forcePathStyle = is.undefined(s3PathStyle)
      ? !!GlobalConfig.get('s3PathStyle')
      : s3PathStyle;
    const credentials =
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined;
    const client = new S3Client({
      ...(endpoint && { endpoint }),
      ...(forcePathStyle && { forcePathStyle: true }),
      ...(credentials && { credentials }),
    });
    if (!accessKeyId && !secretAccessKey) {
      s3Instance = client;
    }
    return client;
  }
  return s3Instance;
}

export interface S3UrlParts {
  Bucket: string;
  Key: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export function parseS3Url(rawUrl: URL | string): S3UrlParts | null {
  const parsedUrl = typeof rawUrl === 'string' ? parseUrl(rawUrl) : rawUrl;
  if (parsedUrl === null) {
    return null;
  }
  if (parsedUrl.protocol !== 's3:') {
    return null;
  }
  let accessKeyId, secretAccessKey;
  if (parsedUrl.username) {
    accessKeyId = decodeURIComponent(parsedUrl.username);
  }
  if (parsedUrl.password) {
    secretAccessKey = decodeURIComponent(parsedUrl.password);
  }
  return {
    Bucket: parsedUrl.host,
    Key: parsedUrl.pathname.substring(1),
    ...(accessKeyId && { accessKeyId }),
    ...(secretAccessKey && { secretAccessKey }),
  };
}
