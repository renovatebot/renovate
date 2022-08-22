import { Readable } from 'stream';
import {
  GetObjectCommand,
  PutObjectCommand,
  PutObjectCommandInput,
  S3,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import * as s3Wrapper from '../../../s3';
import type { RepoCacheRecord } from '../types';
import { CacheFactory } from './cache-factory';
import { RepoCacheS3 } from './s3';

describe('util/cache/repository/impl/s3', () => {
  const s3WrapperSpy = jest.spyOn(s3Wrapper, 'getS3Client');
  const s3Mock = mockClient(S3);
  const repository = 'org/repo';
  const repoCache = partial<RepoCacheRecord>({ payload: 'payload' });
  const url = 's3://bucket-name';
  const err = new Error('error');

  beforeEach(() => {
    GlobalConfig.set({ platform: 'github' });
    jest.clearAllMocks();
    s3Mock.reset();
    // every test function should have its own s3 instance for it to work
    s3WrapperSpy.mockReturnValueOnce(new S3({}));
  });

  it('successfully reads from s3', async () => {
    s3Mock.on(GetObjectCommand).resolvesOnce({ Body: Readable.from(['{}']) });
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.read()).toResolve();
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith('RepoCacheS3.read() - success');
  });

  it('gets an unexpected response from s3', async () => {
    s3Mock.on(GetObjectCommand).resolvesOnce({});
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.read()).toResolve();
    expect(logger.warn).toHaveBeenCalledWith(
      "RepoCacheS3.read() - failure - expecting Readable return type got 'undefined' type instead"
    );
  });

  it('doesnt warn when no cache is found', async () => {
    const NoSuchKeyErr = new Error('NoSuchKey');
    NoSuchKeyErr.name = 'NoSuchKey';
    s3Mock.on(GetObjectCommand).rejectsOnce(NoSuchKeyErr);
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.read()).toResolve();
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith(
      `RepoCacheS3.read() - 'NoSuchKey'`
    );
  });

  it('fails to read from s3', async () => {
    s3Mock.on(GetObjectCommand).rejectsOnce(err);
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.read()).toResolve();
    expect(logger.warn).toHaveBeenCalledWith(
      { err },
      'RepoCacheS3.read() - failure'
    );
  });

  it('successfully writes to s3', async () => {
    const s3Params: PutObjectCommandInput = {
      Bucket: 'bucket',
      Key: 'key',
      Body: 'body',
    };
    s3Mock.on(PutObjectCommand).resolvesOnce(s3Params);
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.write(repoCache)).toResolve();
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith(
      { res: s3Params },
      'RepoCacheS3.write() - success'
    );
  });

  it('fails to write to s3', async () => {
    s3Mock.on(PutObjectCommand).rejectsOnce(err);
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.write(repoCache)).toResolve();
    expect(logger.warn).toHaveBeenCalledWith(
      { err },
      'RepoCacheS3.write() - failure'
    );
  });

  it('creates an S3 client using the cache factory', () => {
    const cache = CacheFactory.get(repository, url);
    expect(cache instanceof RepoCacheS3).toBeTrue();
  });
});
