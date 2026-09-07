// Singleton S3 instance initialized on-demand.
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { isString, isUndefined } from '@sindresorhus/is';
import { GlobalConfig } from '../config/global.ts';
import { parseUrl } from './url.ts';

let s3Instance: S3Client | undefined;
export function getS3Client(
  // Only needed if GlobalConfig is not initialized due to some error
  s3Endpoint?: string,
  s3PathStyle?: boolean,
  credentials?: S3ClientConfig['credentials'],
): S3Client {
  // Credentials come from host rules, so such clients must not be shared
  if (credentials) {
    return newS3Client(s3Endpoint, s3PathStyle, credentials);
  }

  s3Instance ??= newS3Client(s3Endpoint, s3PathStyle);
  return s3Instance;
}

function newS3Client(
  s3Endpoint: string | undefined,
  s3PathStyle: boolean | undefined,
  credentials?: S3ClientConfig['credentials'],
): S3Client {
  const endpoint = s3Endpoint ?? GlobalConfig.get('s3Endpoint');
  const forcePathStyle = isUndefined(s3PathStyle)
    ? !!GlobalConfig.get('s3PathStyle')
    : s3PathStyle;
  return new S3Client({
    ...(endpoint && { endpoint }),
    ...(forcePathStyle && { forcePathStyle: true }),
    ...(credentials && { credentials }),
  });
}

export interface S3UrlParts {
  Bucket: string;
  Key: string;
}

export function parseS3Url(rawUrl: URL | string): S3UrlParts | null {
  const parsedUrl = isString(rawUrl) ? parseUrl(rawUrl) : rawUrl;
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
