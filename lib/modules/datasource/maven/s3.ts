// Singleton S3 instance initialized on-demand.
import { S3 } from '@aws-sdk/client-s3';
import { parseUrl } from '../../../util/url';

let s3Instance: S3;
export function getS3Client(): S3 {
  if (!s3Instance) {
    s3Instance = new S3({});
  }
  return s3Instance;
}

export interface S3Url {
  Bucket: string;
  Key: string;
}

export function parseS3Url(rawUrl: string): S3Url | null {
  const parsedUrl = parseUrl(rawUrl);
  if (parsedUrl === null) {
    return null;
  }
  return {
    Bucket: parsedUrl.host,
    Key: parsedUrl.pathname.substring(1),
  };
}
