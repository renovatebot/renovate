import { fs, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import type { RepoCacheRecord } from '../schema.ts';
import { CacheFactory } from './cache-factory.ts';
import { RepoCacheGCS } from './gcs.ts';

vi.mock('../../../fs/index.ts');

const gcsMock = vi.hoisted(() => {
  const fileApi = { download: vi.fn(), save: vi.fn() };
  const file = vi.fn(() => fileApi);
  const bucket = vi.fn(() => ({ file }));
  return { fileApi, file, bucket, gcsClient: { bucket } };
});

vi.mock('../../../gcs.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../gcs.ts')>();
  return {
    ...actual,
    getGCSClient: vi.fn(() => gcsMock.gcsClient),
  };
});

describe('util/cache/repository/impl/gcs', () => {
  const repository = 'org/repo';
  const repoCache = partial<RepoCacheRecord>({ payload: 'payload' });
  const url = 'gs://bucket-name';
  const err = new Error('error');
  let gcsCache: RepoCacheGCS;

  beforeEach(() => {
    GlobalConfig.set({ cacheDir: '/tmp/cache', platform: 'github' });
    gcsCache = new RepoCacheGCS(repository, '0123456789abcdef', url);
  });

  it('successfully reads from gcs', async () => {
    gcsMock.fileApi.download.mockResolvedValue([Buffer.from('data')]);

    await expect(gcsCache.read()).resolves.toBe('data');
    expect(logger.warn).toHaveBeenCalledTimes(0);
  });

  it('returns null when the cache file does not exist', async () => {
    gcsMock.fileApi.download.mockRejectedValue(
      Object.assign(new Error('Not Found'), { code: 404 }),
    );

    await expect(gcsCache.read()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(0);
  });

  it('returns null and warns on read failure', async () => {
    gcsMock.fileApi.download.mockRejectedValue(err);

    await expect(gcsCache.read()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      { err },
      'RepoCacheGCS.read() - failure',
    );
  });

  it('successfully writes to gcs', async () => {
    await gcsCache.write(repoCache);

    expect(gcsMock.fileApi.save).toHaveBeenCalledWith(
      JSON.stringify(repoCache),
      { contentType: 'application/json', resumable: false },
    );
    expect(fs.outputCacheFile).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(0);
  });

  it('warns on write failure', async () => {
    gcsMock.fileApi.save.mockRejectedValue(err);

    await expect(gcsCache.write(repoCache)).toResolve();
    expect(logger.warn).toHaveBeenCalledWith(
      { err },
      'RepoCacheGCS.write() - failure',
    );
  });

  it('uses the folder prefix from the url', () => {
    expect(gcsMock.bucket).toHaveBeenCalledWith('bucket-name');
    expect(gcsMock.file).toHaveBeenLastCalledWith('github/org/repo/cache.json');

    new RepoCacheGCS(repository, '0123456789abcdef', 'gs://bucket-name/dir/');

    expect(gcsMock.file).toHaveBeenLastCalledWith(
      'dir/github/org/repo/cache.json',
    );
    expect(logger.warn).toHaveBeenCalledTimes(0);
  });

  it('warns and appends a missing trailing slash', () => {
    new RepoCacheGCS(repository, '0123456789abcdef', 'gs://bucket-name/dir');

    expect(logger.warn).toHaveBeenCalledWith(
      { pathname: 'dir' },
      'RepoCacheGCS.getCacheFolder() - appending missing trailing slash to pathname',
    );
    expect(gcsMock.file).toHaveBeenLastCalledWith(
      'dir/github/org/repo/cache.json',
    );
  });

  it('reads and writes under a folder prefix', async () => {
    const folderCache = new RepoCacheGCS(
      repository,
      '0123456789abcdef',
      'gs://bucket-name/dir1/dirN/',
    );
    gcsMock.fileApi.download.mockResolvedValue([Buffer.from('data')]);

    await expect(folderCache.read()).resolves.toBe('data');
    await folderCache.write(repoCache);

    expect(gcsMock.file).toHaveBeenLastCalledWith(
      'dir1/dirN/github/org/repo/cache.json',
    );
    expect(gcsMock.fileApi.save).toHaveBeenCalledOnce();
  });

  it('persists data locally after uploading to gcs', async () => {
    GlobalConfig.set({ repositoryCacheForceLocal: true });

    await gcsCache.write(repoCache);

    expect(gcsMock.fileApi.save).toHaveBeenCalledOnce();
    expect(fs.outputCacheFile).toHaveBeenCalledExactlyOnceWith(
      'renovate/repository/github/org/repo.json',
      JSON.stringify(repoCache),
    );
  });

  it('warns and does not persist data locally when uploading to gcs fails', async () => {
    GlobalConfig.set({ repositoryCacheForceLocal: true });
    gcsMock.fileApi.save.mockRejectedValue(err);

    await expect(gcsCache.write(repoCache)).toResolve();
    expect(logger.warn).toHaveBeenCalledWith(
      { err },
      'RepoCacheGCS.write() - failure',
    );
    expect(fs.outputCacheFile).not.toHaveBeenCalled();
  });

  it('returns RepoCacheGCS for gs urls', () => {
    const cache = CacheFactory.get(repository, '0123456789abcdef', url);

    expect(cache instanceof RepoCacheGCS).toBeTrue();
  });

  it.each`
    cacheType
    ${'gs://'}
    ${'gs:///prefix'}
    ${'gs'}
  `(
    'tolerates a malformed GCS URL $cacheType',
    async ({ cacheType }: { cacheType: string }) => {
      const cache = new RepoCacheGCS(repository, '0123456789abcdef', cacheType);

      await expect(cache.read()).resolves.toBeNull();
      await expect(cache.write(repoCache)).toResolve();
      expect(gcsMock.fileApi.save).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenNthCalledWith(
        1,
        { url: cacheType },
        'RepoCacheGCS() - invalid GCS URL',
      );
      expect(logger.warn).toHaveBeenNthCalledWith(
        2,
        'RepoCacheGCS.write() - invalid GCS URL',
      );
    },
  );

  it.each`
    cacheType
    ${'gs://'}
    ${'gs:///prefix'}
    ${'gs'}
  `(
    'routes a malformed GCS URL through the cache factory to the GCS cache $cacheType',
    ({ cacheType }: { cacheType: string }) => {
      const cache = CacheFactory.get(repository, '0123456789abcdef', cacheType);

      expect(cache instanceof RepoCacheGCS).toBeTrue();
    },
  );

  it('does not persist data locally for a malformed GCS URL', async () => {
    GlobalConfig.set({ repositoryCacheForceLocal: true });
    const cache = new RepoCacheGCS(repository, '0123456789abcdef', 'gs://');

    await expect(cache.write(repoCache)).toResolve();

    expect(gcsMock.fileApi.save).not.toHaveBeenCalled();
    expect(fs.outputCacheFile).not.toHaveBeenCalled();
  });
});
