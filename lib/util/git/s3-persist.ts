import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type {
  GetObjectCommandInput,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs-extra';
import * as tar from 'tar';
import upath from 'upath';
import { instrument } from '../../instrumentation/index.ts';
import { logger } from '../../logger/index.ts';
import { getS3Client, parseS3Url } from '../s3.ts';

function getS3Key(
  s3Url: string,
  platform: string,
  repository: string,
): { bucket: string; key: string } {
  const parsed = parseS3Url(s3Url);
  if (!parsed) {
    throw new Error(`Invalid S3 URL: ${s3Url}`);
  }
  let prefix = parsed.Key;
  if (prefix && !prefix.endsWith('/')) {
    logger.warn(
      { pathname: prefix },
      'getS3Key() - appending missing trailing slash to pathname',
    );
    prefix += '/';
  }
  return {
    bucket: parsed.Bucket,
    key: `${prefix}${platform}/${repository}/git-data.tar.gz`,
  };
}

export async function restoreGitDataFromS3(
  localDir: string,
  s3Url: string,
  platform: string,
  repository: string,
): Promise<boolean> {
  return await instrument('restoreGitFromS3', async () => {
    const { bucket, key } = getS3Key(s3Url, platform, repository);
    const s3Params: GetObjectCommandInput = {
      Bucket: bucket,
      Key: key,
    };

    try {
      const { Body: body } = await getS3Client().send(
        new GetObjectCommand(s3Params),
      );
      if (!(body instanceof Readable)) {
        logger.warn(
          { returnType: typeof body },
          'restoreGitDataFromS3() - unexpected response type from S3',
        );
        return false;
      }

      await pipeline(body, tar.extract({ cwd: localDir }));

      const gitHead = upath.join(localDir, '.git/HEAD');
      if (await fs.pathExists(gitHead)) {
        logger.debug({ key }, 'restoreGitDataFromS3() - success');
        return true;
      }

      logger.warn(
        { key },
        'restoreGitDataFromS3() - archive extracted but .git/HEAD not found, cleaning up',
      );
      await fs.remove(upath.join(localDir, '.git'));
      return false;
    } catch (err) {
      // https://docs.aws.amazon.com/AmazonS3/latest/API/ErrorResponses.html
      if (err.name === 'NoSuchKey') {
        logger.debug('restoreGitDataFromS3() - no archive found in S3');
        return false;
      }
      logger.warn({ err }, 'restoreGitDataFromS3() - failure');
      return false;
    }
  });
}

export async function archiveGitDataToS3(
  localDir: string,
  s3Url: string,
  platform: string,
  repository: string,
): Promise<void> {
  await instrument('archiveGitToS3', async () => {
    const gitDir = upath.join(localDir, '.git');
    if (!(await fs.pathExists(gitDir))) {
      logger.debug('archiveGitDataToS3() - no .git directory found, skipping');
      return;
    }

    const { bucket, key } = getS3Key(s3Url, platform, repository);

    try {
      const archiveStream = tar.create(
        { gzip: true, cwd: localDir, portable: true },
        ['.git'],
      );
      const body = new PassThrough();

      const s3Params: PutObjectCommandInput = {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'application/gzip',
      };

      await Promise.all([
        getS3Client().send(new PutObjectCommand(s3Params)),
        pipeline(archiveStream, body),
      ]);
      logger.debug({ key }, 'archiveGitDataToS3() - success');
    } catch (err) {
      logger.warn({ err }, 'archiveGitDataToS3() - failure');
    }
  });
}
