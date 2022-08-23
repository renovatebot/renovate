import { promisify } from 'util';
import zlib from 'zlib';
import hasha from 'hasha';
import { fs } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { CACHE_REVISION } from '../common';
import type { RepoCacheData, RepoCacheWritableRecord } from '../types';
import { CacheFactory } from './cache-factory';
import { RepoCacheLocal } from './local';

jest.mock('../../../fs');

const compress = promisify(zlib.brotliCompress);

async function createCacheRecord(
  data: RepoCacheData,
  repository = 'some/repo'
): Promise<RepoCacheWritableRecord> {
  const revision = CACHE_REVISION;
  const fingerprint = '0123456789abcdef';
  const jsonStr = JSON.stringify(data);
  const hash = hasha(jsonStr, { algorithm: 'sha256' });
  const compressed = await compress(jsonStr);
  const payload = compressed.toString('base64');
  return { revision, repository, payload, hash, fingerprint };
}

describe('util/cache/repository/impl/local', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    GlobalConfig.set({ cacheDir: '/tmp/cache', platform: 'github' });
  });

  it('returns empty object before any data load', () => {
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );
    expect(localRepoCache.getData()).toBeEmpty();
  });

  it('skip when receives non-string data', async () => {
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );
    await localRepoCache.load(); // readCacheFile is mocked but has no return value set - therefore returns undefined
    expect(logger.debug).toHaveBeenCalledWith(
      "RepoCacheBase.load() - expecting data of type 'string' received 'undefined' instead - skipping"
    );
  });

  it('loads previously stored cache from disk', async () => {
    const data: RepoCacheData = { semanticCommits: 'enabled' };
    const cacheRecord = await createCacheRecord(data);
    fs.readCacheFile.mockResolvedValue(JSON.stringify(cacheRecord));
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );

    await localRepoCache.load();

    expect(localRepoCache.getData()).toEqual(data);
  });

  it('drops data with invalid repository fingerprint', async () => {
    const data: RepoCacheData = { semanticCommits: 'enabled' };
    const cacheRecord = {
      ...(await createCacheRecord(data)),
      fingerprint: '111',
    };
    fs.readCacheFile.mockResolvedValue(JSON.stringify(cacheRecord));

    const cache1 = CacheFactory.get('some/repo', '111', 'local');
    await cache1.load();
    expect(cache1.getData()).toEqual(data);

    const cache2 = CacheFactory.get('some/repo', '222', 'local');
    await cache2.load();
    expect(cache2.getData()).toBeEmpty();
  });

  it('migrates revision from 10 to 13', async () => {
    fs.readCacheFile.mockResolvedValue(
      JSON.stringify({
        revision: 10,
        repository: 'some/repo',
        semanticCommits: 'enabled',
      })
    );
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );

    await localRepoCache.load();
    await localRepoCache.save();

    const cacheRecord = await createCacheRecord({ semanticCommits: 'enabled' });
    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      '/tmp/cache/renovate/repository/github/some/repo.json',
      JSON.stringify(cacheRecord)
    );
  });

  it('migrates revision from 11 to 13', async () => {
    fs.readCacheFile.mockResolvedValue(
      JSON.stringify({
        revision: 11,
        repository: 'some/repo',
        data: { semanticCommits: 'enabled' },
      })
    );
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );

    await localRepoCache.load();
    await localRepoCache.save();

    const cacheRecord = await createCacheRecord({ semanticCommits: 'enabled' });
    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      '/tmp/cache/renovate/repository/github/some/repo.json',
      JSON.stringify(cacheRecord)
    );
  });

  it('migrates revision from 12 to 13', async () => {
    const { repository, payload, hash } = await createCacheRecord({
      semanticCommits: 'enabled',
    });

    fs.readCacheFile.mockResolvedValue(
      JSON.stringify({ revision: 12, repository, payload, hash })
    );
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );

    await localRepoCache.load();
    const data = localRepoCache.getData();
    data.semanticCommits = 'disabled';
    await localRepoCache.save();

    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      '/tmp/cache/renovate/repository/github/some/repo.json',
      JSON.stringify(
        await createCacheRecord({
          semanticCommits: 'disabled',
        })
      )
    );
  });

  it('does not migrate from older revisions to 11', async () => {
    fs.readCacheFile.mockResolvedValueOnce(
      JSON.stringify({
        revision: 9,
        repository: 'some/repo',
        semanticCommits: 'enabled',
      })
    );

    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );
    await localRepoCache.load();

    expect(localRepoCache.getData()).toBeEmpty();
  });

  it('handles invalid data', async () => {
    fs.readCacheFile.mockResolvedValue(JSON.stringify({ foo: 'bar' }));
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );

    await localRepoCache.load();

    expect(localRepoCache.getData()).toBeEmpty();
  });

  it('handles file read error', async () => {
    fs.readCacheFile.mockRejectedValue(new Error('unknown error'));
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );

    await localRepoCache.load();

    const data = localRepoCache.getData();
    expect(data).toBeEmpty();
  });

  it('handles invalid json', async () => {
    fs.readCacheFile.mockResolvedValue('{1');
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );

    await localRepoCache.load();

    expect(localRepoCache.getData()).toBeEmpty();
  });

  it('resets if repository does not match', async () => {
    const cacheRecord = createCacheRecord({ semanticCommits: 'enabled' });
    fs.readCacheFile.mockResolvedValueOnce(JSON.stringify(cacheRecord));

    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );
    await localRepoCache.load();

    expect(localRepoCache.getData()).toBeEmpty();
  });

  it('saves modified cache data to file', async () => {
    const oldCacheRecord = createCacheRecord({ semanticCommits: 'enabled' });
    const cacheType = 'protocol://domain/path';
    fs.readCacheFile.mockResolvedValueOnce(JSON.stringify(oldCacheRecord));
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      cacheType
    );
    await localRepoCache.load();
    const data = localRepoCache.getData();
    data.semanticCommits = 'disabled';
    await localRepoCache.save();

    const newCacheRecord = await createCacheRecord({
      semanticCommits: 'disabled',
    });
    expect(localRepoCache instanceof RepoCacheLocal).toBeTrue();
    expect(logger.warn).toHaveBeenCalledWith(
      { cacheType },
      `Repository cache type not supported using type "local" instead`
    );
    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      '/tmp/cache/renovate/repository/github/some/repo.json',
      JSON.stringify(newCacheRecord)
    );
  });

  describe('Gradual migration from 12 to 13', () => {
    test.each`
      bucket | revision
      ${'0'} | ${13}
      ${'1'} | ${12}
      ${'2'} | ${12}
      ${'3'} | ${12}
      ${'4'} | ${12}
      ${'5'} | ${12}
      ${'6'} | ${12}
      ${'7'} | ${12}
      ${'8'} | ${12}
      ${'9'} | ${12}
      ${'a'} | ${12}
      ${'b'} | ${12}
      ${'c'} | ${12}
      ${'d'} | ${12}
      ${'e'} | ${12}
      ${'f'} | ${12}
    `('Bucket: %i', async ({ bucket, revision }) => {
      const cacheRecord = await createCacheRecord({
        semanticCommits: 'enabled',
      });
      const fingerprint = `${String(bucket)}0123456789abcdef`;

      fs.readCacheFile.mockResolvedValue(
        JSON.stringify({
          ...cacheRecord,
          revision: 12,
          fingerprint,
        })
      );

      const localRepoCache = CacheFactory.get(
        'some/repo',
        fingerprint,
        'local'
      );
      await localRepoCache.load();
      const data = localRepoCache.getData();
      data.semanticCommits = 'disabled';
      await localRepoCache.save();

      const rawJson = fs.outputCacheFile.mock.calls[0][1] as string;
      const stored = JSON.parse(rawJson);
      expect(stored).toMatchObject({ revision });
    });
  });
});
