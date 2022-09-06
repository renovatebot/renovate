import { promisify } from 'util';
import zlib from 'zlib';
import hasha from 'hasha';
import { fs } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { CACHE_REVISION } from '../common';
import type { RepoCacheData, RepoCacheRecord } from '../types';
import { CacheFactory } from './cache-factory';
import { RepoCacheLocal } from './local';

jest.mock('../../../fs');

const compress = promisify(zlib.brotliCompress);

async function createCacheRecord(
  data: RepoCacheData,
  repository = 'some/repo'
): Promise<RepoCacheRecord> {
  const revision = CACHE_REVISION;

  const fingerprint = '0123456789abcdef';

  const jsonStr = JSON.stringify(data);
  const hash = hasha(jsonStr);
  const compressedPayload = await compress(jsonStr);
  const payload = compressedPayload.toString('base64');

  return {
    revision,
    repository,
    fingerprint,
    payload,
    hash,
  };
}

describe('util/cache/repository/impl/local', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    GlobalConfig.set({ cacheDir: '/tmp/cache', platform: 'github' });
    fs.cachePathExists.mockResolvedValue(true);
  });

  it('returns empty object before any data load', () => {
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );
    expect(localRepoCache.getData()).toBeEmpty();
    expect(localRepoCache.isModified()).toBeUndefined();
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
    expect(localRepoCache.isModified()).toBeUndefined();
  });

  it('skip when not found', async () => {
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      'local'
    );
    await localRepoCache.load(); // readCacheFile is mocked but has no return value set - therefore returns undefined
    expect(logger.debug).not.toHaveBeenCalledWith();
    expect(localRepoCache.isModified()).toBeUndefined();
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
    expect(localRepoCache.isModified()).toBeFalse();
  });

  it('resets if fingerprint does not match', async () => {
    const data: RepoCacheData = { semanticCommits: 'enabled' };
    const cacheRecord: RepoCacheRecord = {
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
    expect(localRepoCache.isModified()).toBeUndefined();
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
    expect(localRepoCache.isModified()).toBeUndefined();
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
    expect(localRepoCache.isModified()).toBeUndefined();
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
    expect(localRepoCache.isModified()).toBeUndefined();
  });

  it('saves modified cache data to file', async () => {
    const oldCacheRecord = await createCacheRecord({
      semanticCommits: 'enabled',
    });
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
    expect(localRepoCache.isModified()).toBeTrue();
    expect(logger.warn).toHaveBeenCalledWith(
      { cacheType },
      `Repository cache type not supported using type "local" instead`
    );
    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      '/tmp/cache/renovate/repository/github/some/repo.json',
      JSON.stringify(newCacheRecord)
    );
  });

  it('does not write cache that is not changed', async () => {
    const oldCacheRecord = await createCacheRecord({
      semanticCommits: 'enabled',
    });
    const cacheType = 'protocol://domain/path';
    fs.readCacheFile.mockResolvedValueOnce(JSON.stringify(oldCacheRecord));
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      cacheType
    );

    await localRepoCache.load();
    expect(localRepoCache.getData()).toEqual({ semanticCommits: 'enabled' });
    expect(localRepoCache.isModified()).toBeFalse();

    await localRepoCache.save();

    expect(fs.outputCacheFile).not.toHaveBeenCalledWith();
  });

  it('does not write cache when only key order has changed', async () => {
    const oldCacheRecord = await createCacheRecord({
      configFileName: 'renovate.json',
      semanticCommits: 'enabled',
    });
    const cacheType = 'protocol://domain/path';
    fs.readCacheFile.mockResolvedValueOnce(JSON.stringify(oldCacheRecord));
    const localRepoCache = CacheFactory.get(
      'some/repo',
      '0123456789abcdef',
      cacheType
    );

    await localRepoCache.load();
    const data = localRepoCache.getData();
    delete data.configFileName;
    delete data.semanticCommits;
    data.semanticCommits = 'enabled';
    data.configFileName = 'renovate.json';

    expect(localRepoCache.isModified()).toBeFalse();

    await localRepoCache.save();

    expect(fs.outputCacheFile).not.toHaveBeenCalledWith();
  });
});
