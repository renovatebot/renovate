// Singleton S3 instance initialized on-demand.
import { S3 } from '@aws-sdk/client-s3';
import { parseUrl } from '../../../util/url';

let s3Instance: S3;
function getS3Client(): S3 {
  if (!s3Instance) {
    s3Instance = new S3({});
  }
  return s3Instance;
}

interface S3Url {
  Bucket: string;
  Key: string;
}

function parseS3Url(rawUrl: string): S3Url {
  const parsedUrl = parseUrl(rawUrl);
  return {
    Bucket: parsedUrl.host,
    Key: parsedUrl.pathname.substring(1),
  };
}

export { getS3Client, parseS3Url };
