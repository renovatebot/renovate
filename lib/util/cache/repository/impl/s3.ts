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

  constructor(repository: string, url: string) {
    super(repository);
    this.bucket = parseS3Url(url)?.Bucket;
    this.s3Client = getS3Client();
  }

  async read(): Promise<string | undefined> {
    const cacheFileName = this.getCacheFileName();
    const s3Params: GetObjectCommandInput = {
      Bucket: this.bucket,
      Key: cacheFileName,
    };
    try {
      const { Body: res } = await this.s3Client.send(
        new GetObjectCommand(s3Params)
      );
      logger.debug('RepoCacheS3.read() - success');
      if (res instanceof Readable) {
        return JSON.parse(await streamToString(res));
      }
    } catch (err) {
      logger.warn({ err }, 'RepoCacheS3.read() - failure');
    }
    return undefined;
  }

  async write(data: RepoCacheRecord): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    const s3Params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: cacheFileName,
      Body: JSON.stringify(data),
      ContentType: 'text/plain',
    };
    try {
      const res = await this.s3Client.send(new PutObjectCommand(s3Params));
      logger.debug({ res }, 'RepoCacheS3.write() - success');
    } catch (err) {
      logger.warn({ err }, 'RepoCacheS3.write() - failure');
    }
  }

  private getCacheFileName(): string {
    return `${this.platform}/${this.repository}/cache.json`;
  }
}
