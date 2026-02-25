import { Readable } from 'node:stream';
import type {
  GetObjectCommandInput,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import { outputCacheFile } from '../../../fs/index.ts';
import { getS3Client, parseS3Url } from '../../../s3.ts';
import { streamToString } from '../../../streams.ts';
import { getLocalCacheFileName } from '../common.ts';
import type { RepoCacheRecord } from '../schema.ts';
import { RepoCacheBase } from './base.ts';

export class RepoCacheS3 extends RepoCacheBase {
  private readonly s3Client;
  private readonly bucket;
  private readonly dir;

  constructor(repository: string, fingerprint: string, url: string) {
    super(repository, fingerprint);
    const { Bucket, Key } = parseS3Url(url)!;
    this.dir = this.getCacheFolder(Key);
    this.bucket = Bucket;
    this.s3Client = getS3Client();
  }

  async read(): Promise<string | null> {
    const cacheFileName = this.getCacheFileName();
    const s3Params: GetObjectCommandInput = {
      Bucket: this.bucket,
      Key: cacheFileName,
    };
    try {
      const { Body: res } = await this.s3Client.send(
        new GetObjectCommand(s3Params),
      );
      if (res instanceof Readable) {
        logger.debug('RepoCacheS3.read() - success');
        return await streamToString(res);
      }
      logger.warn(
        { returnType: typeof res },
        'RepoCacheS3.read() - failure - got unexpected return type',
      );
    } catch (err) {
      // https://docs.aws.amazon.com/AmazonS3/latest/API/ErrorResponses.html
      if (err.name === 'NoSuchKey') {
        logger.debug('RepoCacheS3.read() - No cached file found');
      } else {
        logger.warn({ err }, 'RepoCacheS3.read() - failure');
      }
    }
    return null;
  }

  async write(data: RepoCacheRecord): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    const stringifiedCache = JSON.stringify(data);
    const s3Params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: cacheFileName,
      Body: stringifiedCache,
      ContentType: 'application/json',
    };
    try {
      await this.s3Client.send(new PutObjectCommand(s3Params));
      if (GlobalConfig.get('repositoryCacheForceLocal')) {
        const cacheLocalFileName = getLocalCacheFileName(
          this.platform,
          this.repository,
        );
        await outputCacheFile(cacheLocalFileName, stringifiedCache);
      }
    } catch (err) {
      logger.warn({ err }, 'RepoCacheS3.write() - failure');
    }
  }

  private getCacheFolder(pathname: string | undefined): string {
    if (!pathname) {
      return '';
    }

    if (pathname.endsWith('/')) {
      return pathname;
    }

    logger.warn(
      { pathname },
      'RepoCacheS3.getCacheFolder() - appending missing trailing slash to pathname',
    );
    return pathname + '/';
  }

  private getCacheFileName(): string {
    return `${this.dir}${this.platform}/${this.repository}/cache.json`;
  }
}
