import { Readable } from 'stream';
import {
  GetObjectCommand,
  GetObjectCommandInput,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { logger } from '../../../../logger';
import { getS3Client, parseS3Url } from '../../../s3';
import { streamToString } from '../../../streams';
import type { RepoCacheRecord } from '../types';
import { RepoCacheBase } from './base';

export class RepoCacheS3 extends RepoCacheBase {
  private readonly s3Client;
  private readonly bucket;

  constructor(repository: string, fingerprint: string, url: string) {
    super(repository, fingerprint);
    this.bucket = parseS3Url(url)?.Bucket;
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
        new GetObjectCommand(s3Params)
      );
      if (res instanceof Readable) {
        logger.debug('RepoCacheS3.read() - success');
        return await streamToString(res);
      }
      logger.warn(
        `RepoCacheS3.read() - failure - expecting Readable return type got '${typeof res}' type instead`
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
    const s3Params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: cacheFileName,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    };
    try {
      await this.s3Client.send(new PutObjectCommand(s3Params));
    } catch (err) {
      logger.warn({ err }, 'RepoCacheS3.write() - failure');
    }
  }

  private getCacheFileName(): string {
    return `${this.platform}/${this.repository}/cache.json`;
  }
}
