import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  GetObjectCommandInput,
  PutObjectCommand,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { parseS3Url } from '../../../s3';
import type { RepoCacheRecord } from '../schema';
import { CacheFactory } from './cache-factory';
import { RepoCacheS3 } from './s3';

function createGetObjectCommandInput(
  repository: string,
  url: string,
  folder = '',
): GetObjectCommandInput {
  const platform = GlobalConfig.get('platform')!;
  return {
    Bucket: parseS3Url(url)?.Bucket,
    Key: `${folder}${platform}/${repository}/cache.json`,
  };
}

function createPutObjectCommandInput(
  repository: string,
  url: string,
  data: RepoCacheRecord,
  folder = '',
): PutObjectCommandInput {
  return {
    ...createGetObjectCommandInput(repository, url, folder),
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  };
}

/*
 * Note: MockedClient.on(Command, input) will match input (using Sinon matchers) to the actual
 *       'new Command(actualInput)' call within the tested code segment.
 */

describe('util/cache/repository/impl/s3', () => {
  const s3Mock = mockClient(S3Client);
  const repository = 'org/repo';
  const repoCache = partial<RepoCacheRecord>({ payload: 'payload' });
  const url = 's3://bucket-name';
  const err = new Error('error');
  let getObjectCommandInput: GetObjectCommandInput;
  let putObjectCommandInput: PutObjectCommandInput;
  let s3Cache: RepoCacheS3;

  beforeEach(() => {
    GlobalConfig.set({ platform: 'github' });
    s3Mock.reset();
    s3Cache = new RepoCacheS3(repository, '0123456789abcdef', url);
    getObjectCommandInput = createGetObjectCommandInput(repository, url);
    putObjectCommandInput = createPutObjectCommandInput(
      repository,
      url,
      repoCache,
    );
  });

  it('successfully reads from s3', async () => {
    const json = '{}';
    s3Mock
      .on(GetObjectCommand, getObjectCommandInput)
      .resolvesOnce({ Body: Readable.from([json]) as never });
    await expect(s3Cache.read()).resolves.toBe(json);
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith('RepoCacheS3.read() - success');
  });

  it('successfully reads from s3://bucket/dir1/.../dirN/', async () => {
    const json = '{}';
    const folder = 'dir1/dir2/dir3/';
    s3Cache = new RepoCacheS3(
      repository,
      '0123456789abcdef',
      `${url}/${folder}`,
    );
    s3Mock
      .on(
        GetObjectCommand,
        createGetObjectCommandInput(repository, url, folder),
      )
      .resolvesOnce({ Body: Readable.from([json]) as never });
    await expect(s3Cache.read()).resolves.toBe(json);
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.error).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith('RepoCacheS3.read() - success');
  });

  it('appends a missing traling slash to pathname when instantiating RepoCacheS3', async () => {
    const json = '{}';
    const pathname = 'dir1/dir2/dir3/file.ext';
    s3Cache = new RepoCacheS3(
      repository,
      '0123456789abcdef',
      `${url}/${pathname}`,
    );
    s3Mock
      .on(
        GetObjectCommand,
        createGetObjectCommandInput(repository, url, pathname + '/'),
      )
      .resolvesOnce({ Body: Readable.from([json]) as never });
    await expect(s3Cache.read()).resolves.toBe(json);
    expect(logger.debug).toHaveBeenCalledWith('RepoCacheS3.read() - success');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { pathname },
      'RepoCacheS3.getCacheFolder() - appending missing trailing slash to pathname',
    );
  });

  it('gets an unexpected response from s3', async () => {
    s3Mock.on(GetObjectCommand, getObjectCommandInput).resolvesOnce({});
    await expect(s3Cache.read()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "RepoCacheS3.read() - failure - expecting Readable return type got 'undefined' type instead",
    );
  });

  it('doesnt warn when no cache is found', async () => {
    const NoSuchKeyErr = new Error('NoSuchKey');
    NoSuchKeyErr.name = 'NoSuchKey';
    s3Mock
      .on(GetObjectCommand, getObjectCommandInput)
      .rejectsOnce(NoSuchKeyErr);
    await expect(s3Cache.read()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith(
      `RepoCacheS3.read() - No cached file found`,
    );
  });

  it('fails to read from s3', async () => {
    s3Mock.on(GetObjectCommand, getObjectCommandInput).rejectsOnce(err);
    await expect(s3Cache.read()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      { err },
      'RepoCacheS3.read() - failure',
    );
  });

  it('successfully writes to s3', async () => {
    const putObjectCommandOutput: PutObjectCommandOutput = {
      $metadata: { attempts: 1, httpStatusCode: 200, totalRetryDelay: 0 },
    };
    s3Mock
      .on(PutObjectCommand, putObjectCommandInput)
      .resolvesOnce(putObjectCommandOutput);
    await expect(s3Cache.write(repoCache)).toResolve();
    expect(logger.warn).toHaveBeenCalledTimes(0);
  });

  it('successfully writes to s3://bucket/dir1/.../dirN/', async () => {
    const putObjectCommandOutput: PutObjectCommandOutput = {
      $metadata: { attempts: 1, httpStatusCode: 200, totalRetryDelay: 0 },
    };
    const folder = 'dir1/dir2/dir3/';
    s3Cache = new RepoCacheS3(
      repository,
      '0123456789abcdef',
      `${url}/${folder}`,
    );
    s3Mock
      .on(
        PutObjectCommand,
        createPutObjectCommandInput(repository, url, repoCache, folder),
      )
      .resolvesOnce(putObjectCommandOutput);
    await expect(s3Cache.write(repoCache)).toResolve();
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.error).toHaveBeenCalledTimes(0);
  });

  it('fails to write to s3', async () => {
    s3Mock.on(PutObjectCommand, putObjectCommandInput).rejectsOnce(err);
    await expect(s3Cache.write(repoCache)).toResolve();
    expect(logger.warn).toHaveBeenCalledWith(
      { err },
      'RepoCacheS3.write() - failure',
    );
  });

  it('creates an S3 client using the cache factory', () => {
    const cache = CacheFactory.get(repository, '0123456789abcdef', url);
    expect(cache instanceof RepoCacheS3).toBeTrue();
  });
});
