import { Readable } from 'stream';
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
import * as s3Wrapper from '../../../s3';
import type { RepoCacheRecord } from '../types';
import { CacheFactory } from './cache-factory';
import { RepoCacheS3 } from './s3';

function createGetObjectCommandInput(
  repository: string,
  url: string
): GetObjectCommandInput {
  const platform = GlobalConfig.get('platform') ?? 'github';
  return {
    Bucket: parseS3Url(url)?.Bucket,
    Key: `${platform}/${repository}/cache.json`,
  };
}

function createPutObjectCommandInput(
  repository: string,
  url: string,
  data: RepoCacheRecord
): PutObjectCommandInput {
  return {
    ...createGetObjectCommandInput(repository, url),
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  };
}

/*
 * Note: MockedClient.on(Command, input) will match input (using Sinon matchers) to the actual
 *       'new Command(actualInput)' call within the tested code segment.
 */

describe('util/cache/repository/impl/s3', () => {
  const s3WrapperSpy = jest.spyOn(s3Wrapper, 'getS3Client');
  const s3Mock = mockClient(S3Client);
  const repository = 'org/repo';
  const repoCache = partial<RepoCacheRecord>({ payload: 'payload' });
  const url = 's3://bucket-name';
  const err = new Error('error');
  let getObjectCommandInput: GetObjectCommandInput;
  let putObjectCommandInput: PutObjectCommandInput;

  beforeEach(() => {
    GlobalConfig.set({ platform: 'github' });
    jest.clearAllMocks();
    s3Mock.reset();
    // every test function should have its own s3 instance for it to work
    s3WrapperSpy.mockReturnValueOnce(new S3Client({}));
    getObjectCommandInput = createGetObjectCommandInput(repository, url);
    putObjectCommandInput = createPutObjectCommandInput(
      repository,
      url,
      repoCache
    );
  });

  it('successfully reads from s3', async () => {
    s3Mock
      .on(GetObjectCommand, getObjectCommandInput)
      .resolvesOnce({ Body: Readable.from(['{}']) });
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.read()).toResolve();
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith('RepoCacheS3.read() - success');
  });

  it('gets an unexpected response from s3', async () => {
    s3Mock.on(GetObjectCommand, getObjectCommandInput).resolvesOnce({});
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.read()).toResolve();
    expect(logger.warn).toHaveBeenCalledWith(
      "RepoCacheS3.read() - failure - expecting Readable return type got 'undefined' type instead"
    );
  });

  it('doesnt warn when no cache is found', async () => {
    const NoSuchKeyErr = new Error('NoSuchKey');
    NoSuchKeyErr.name = 'NoSuchKey';
    s3Mock
      .on(GetObjectCommand, getObjectCommandInput)
      .rejectsOnce(NoSuchKeyErr);
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.read()).toResolve();
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith(
      `RepoCacheS3.read() - No cached file found`
    );
  });

  it('fails to read from s3', async () => {
    s3Mock.on(GetObjectCommand, getObjectCommandInput).rejectsOnce(err);
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.read()).toResolve();
    expect(logger.warn).toHaveBeenCalledWith(
      { err },
      'RepoCacheS3.read() - failure'
    );
  });

  it('successfully writes to s3', async () => {
    const putObjectCommandOutput: PutObjectCommandOutput = {
      $metadata: { attempts: 1, httpStatusCode: 200, totalRetryDelay: 0 },
    };
    s3Mock
      .on(PutObjectCommand, putObjectCommandInput)
      .resolvesOnce(putObjectCommandOutput);
    const s3Cache = new RepoCacheS3(repository, url);
    await expect(s3Cache.write(repoCache)).toResolve();
    expect(logger.warn).toHaveBeenCalledTimes(0);
  });

  it('fails to write to s3', async () => {
    s3Mock.on(PutObjectCommand, putObjectCommandInput).rejectsOnce(err);
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
