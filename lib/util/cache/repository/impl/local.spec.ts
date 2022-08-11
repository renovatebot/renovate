import { promisify } from 'util';
import zlib from 'zlib';
import hasha from 'hasha';
import { fs } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { CACHE_REVISION } from '../common';
import type { RepoCacheData, RepoCacheRecord } from '../types';
import { CacheClientFactory } from './cache-client-factory';
import { RepositoryCacheHandler } from './repository-cache-handler';

jest.mock('../../../fs');

const compress = promisify(zlib.brotliCompress);

async function createCacheRecord(
  data: RepoCacheData,
  repository = 'some/repo'
): Promise<RepoCacheRecord> {
  const revision = CACHE_REVISION;
  const jsonStr = JSON.stringify(data);
  const hash = hasha(jsonStr, { algorithm: 'sha256' });
  const compressed = await compress(jsonStr);
  const payload = compressed.toString('base64');
  return { revision, repository, payload, hash };
}

describe('util/cache/repository/impl/local', () => {
  beforeEach(() => {
    GlobalConfig.set({ cacheDir: '/tmp/cache', platform: 'github' });
  });

  it('returns empty object before any data load', () => {
    const localRepoCache = new RepositoryCacheHandler('some/repo', 'local');
    expect(localRepoCache.getData()).toBeEmpty();
  });

  it('loads previously stored cache from disk', async () => {
    const data: RepoCacheData = { semanticCommits: 'enabled' };
    const cacheRecord = await createCacheRecord(data);
    fs.readCacheFile.mockResolvedValue(JSON.stringify(cacheRecord));
    const localRepoCache = new RepositoryCacheHandler('some/repo', 'local');

    await localRepoCache.load();

    expect(localRepoCache.getData()).toEqual(data);
  });

  it('migrates revision from 10 to 12', async () => {
    fs.readCacheFile.mockResolvedValue(
      JSON.stringify({
        revision: 10,
        repository: 'some/repo',
        semanticCommits: 'enabled',
      })
    );
    const localRepoCache = new RepositoryCacheHandler('some/repo', 'local');

    await localRepoCache.load();
    await localRepoCache.save();

    const cacheRecord = await createCacheRecord({ semanticCommits: 'enabled' });
    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      '/tmp/cache/renovate/repository/github/some/repo.json',
      JSON.stringify(cacheRecord)
    );
  });

  it('migrates revision from 11 to 12', async () => {
    fs.readCacheFile.mockResolvedValue(
      JSON.stringify({
        revision: 11,
        repository: 'some/repo',
        data: { semanticCommits: 'enabled' },
      })
    );
    const localRepoCache = new RepositoryCacheHandler('some/repo', 'local');

    await localRepoCache.load();
    await localRepoCache.save();

    const cacheRecord = await createCacheRecord({ semanticCommits: 'enabled' });
    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      '/tmp/cache/renovate/repository/github/some/repo.json',
      JSON.stringify(cacheRecord)
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

    const localRepoCache = new RepositoryCacheHandler('some/repo', 'local');
    await localRepoCache.load();

    expect(localRepoCache.getData()).toBeEmpty();
  });

  it('handles invalid data', async () => {
    fs.readCacheFile.mockResolvedValue(JSON.stringify({ foo: 'bar' }));
    const localRepoCache = new RepositoryCacheHandler('some/repo', 'local');

    await localRepoCache.load();

    expect(localRepoCache.getData()).toBeEmpty();
  });

  it('handles file read error', async () => {
    fs.readCacheFile.mockRejectedValue(new Error('unknown error'));
    const localRepoCache = new RepositoryCacheHandler('some/repo', 'local');

    await localRepoCache.load();

    const data = localRepoCache.getData();
    expect(data).toBeEmpty();
  });

  it('resets if repository does not match', async () => {
    const cacheRecord = createCacheRecord({ semanticCommits: 'enabled' });
    fs.readCacheFile.mockResolvedValueOnce(JSON.stringify(cacheRecord));

    const localRepoCache = new RepositoryCacheHandler('some/repo', 'local');
    await localRepoCache.load();

    expect(localRepoCache.getData()).toEqual({});
  });

  it('saves modified cache data to file', async () => {
    const oldCacheRecord = createCacheRecord({ semanticCommits: 'enabled' });
    fs.readCacheFile.mockResolvedValueOnce(JSON.stringify(oldCacheRecord));
    const localRepoCache = new RepositoryCacheHandler('some/repo');

    // TODO: remove use implemented, this test file should test local client only
    CacheClientFactory.reset();
    new RepositoryCacheHandler('some/repo', 'redis://'); // coverage
    CacheClientFactory.reset();
    new RepositoryCacheHandler('some/repo', 'https://s3'); // coverage

    await localRepoCache.load();
    const data = localRepoCache.getData();
    data.semanticCommits = 'disabled';
    await localRepoCache.save();

    const newCacheRecord = await createCacheRecord({
      semanticCommits: 'disabled',
    });
    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      '/tmp/cache/renovate/repository/github/some/repo.json',
      JSON.stringify(newCacheRecord)
    );
  });
});
