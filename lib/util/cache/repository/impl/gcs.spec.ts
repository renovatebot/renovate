import type { Storage } from '@google-cloud/storage';
import { MockStorage } from 'mock-gcs';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { getGcsClient } from '../../../gcs';
import type { RepoCacheRecord } from '../schema';
import { CacheFactory } from './cache-factory';
import { RepoCacheGcs } from './gcs';
import { fs, partial } from '~test/util';

vi.mock('../../../fs');
vi.mock('../../../gcs', { spy: true });

describe('util/cache/repository/impl/gcs', () => {
  let gcsMock: MockStorage;
  const repository = 'org/repo';
  const repoCache = partial<RepoCacheRecord>({ payload: 'payload' });
  const url = 'gs://bucket-name';
  const err = new Error('error');
  let gcsCache: RepoCacheGcs;

  beforeEach(async () => {
    gcsMock = new MockStorage();
    vi.mocked(getGcsClient).mockReturnValue(gcsMock as unknown as Storage);

    // In order for mock-gcs to return the same reference in the repo cache and the tests,
    // we need to pre-create them
    await gcsMock
      .bucket('bucket-name')
      .file('github/org/repo/cache.json')
      .save('{}');
    await gcsMock
      .bucket('bucket-name')
      .file('dir1/dir2/dir3/file.ext/github/org/repo/cache.json')
      .save('{}');
    await gcsMock
      .bucket('bucket-name')
      .file('dir1/dir2/dir3/github/org/repo/cache.json')
      .save('{}');

    GlobalConfig.set({ cacheDir: '/tmp/cache', platform: 'github' });

    gcsCache = new RepoCacheGcs(repository, '0123456789abcdef', url);
  });

  it('successfully reads from GCS', async () => {
    const json = '{}';
    await gcsMock
      .bucket('bucket-name')
      .file('github/org/repo/cache.json')
      .save(json);

    await expect(gcsCache.read()).resolves.toBe(json);
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith('RepoCacheGcs.read() - success');
  });

  it('successfully reads from gs://bucket/dir1/.../dirN/', async () => {
    const json = '{}';
    const folder = 'dir1/dir2/dir3/';
    gcsCache = new RepoCacheGcs(
      repository,
      '0123456789abcdef',
      `${url}/${folder}`,
    );

    await gcsMock
      .bucket('bucket-name')
      .file(`${folder}github/org/repo/cache.json`)
      .save(json);

    await expect(gcsCache.read()).resolves.toBe(json);
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.error).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith('RepoCacheGcs.read() - success');
  });

  it('appends a missing traling slash to pathname when instantiating RepoCacheGcs', async () => {
    const json = '{}';
    const pathname = 'dir1/dir2/dir3/file.ext';
    gcsCache = new RepoCacheGcs(
      repository,
      '0123456789abcdef',
      `${url}/${pathname}`,
    );
    await gcsMock
      .bucket('bucket-name')
      .file(`${pathname}/github/org/repo/cache.json`)
      .save(json);

    await expect(gcsCache.read()).resolves.toBe(json);
    expect(logger.debug).toHaveBeenCalledWith('RepoCacheGcs.read() - success');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { pathname },
      'RepoCacheGcs.getCacheFilename() - appending missing trailing slash to pathname',
    );
  });

  it('doesnt warn when no cache is found', async () => {
    await gcsMock
      .bucket('bucket-name')
      .file('github/org/repo/cache.json')
      .delete();

    await expect(gcsCache.read()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.debug).toHaveBeenCalledWith(
      `RepoCacheGcs.read() - No cached file found`,
    );
  });

  it('fails to read from GCS', async () => {
    gcsMock
      .bucket('bucket-name')
      .file('github/org/repo/cache.json')
      .mockErrorOnce('download', err);

    await expect(gcsCache.read()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      { err },
      'RepoCacheGcs.read() - failure',
    );
  });

  it('successfully writes to GCS', async () => {
    await expect(gcsCache.write(repoCache)).toResolve();

    expect(
      await gcsMock
        .bucket('bucket-name')
        .file('github/org/repo/cache.json')
        .download()
        .then(([c]) => c.toString()),
    ).toEqual(JSON.stringify(repoCache));

    expect(logger.warn).toHaveBeenCalledTimes(0);
  });

  it('successfully writes to gs://bucket/dir1/.../dirN/', async () => {
    const folder = 'dir1/dir2/dir3/';
    gcsCache = new RepoCacheGcs(
      repository,
      '0123456789abcdef',
      `${url}/${folder}`,
    );
    await expect(gcsCache.write(repoCache)).toResolve();

    expect(
      await gcsMock
        .bucket('bucket-name')
        .file(`${folder}github/org/repo/cache.json`)
        .download()
        .then(([c]) => c.toString()),
    ).toEqual(JSON.stringify(repoCache));

    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.error).toHaveBeenCalledTimes(0);
  });

  it('fails to write to GCS', async () => {
    gcsMock
      .bucket('bucket-name')
      .file('github/org/repo/cache.json')
      .mockErrorOnce('save', err);

    await expect(gcsCache.write(repoCache)).toResolve();

    expect(logger.warn).toHaveBeenCalledWith(
      { err },
      'RepoCacheGcs.write() - failure',
    );
  });

  it('creates a GCS client using the cache factory', () => {
    const cache = CacheFactory.get(repository, '0123456789abcdef', url);

    expect(cache instanceof RepoCacheGcs).toBeTrue();
  });

  it('persists data locally after uploading to GCS', async () => {
    process.env.RENOVATE_X_REPO_CACHE_FORCE_LOCAL = 'true';

    await gcsCache.write(repoCache);

    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      'renovate/repository/github/org/repo.json',
      JSON.stringify(repoCache),
    );
  });
});
