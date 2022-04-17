import * as _fs from 'fs-extra';
import { mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { initRepoCache } from './init';
import type { RepoCacheRecord } from './types';
import * as repositoryCache from '.';

jest.mock('fs-extra');

const fs = mocked(_fs);

describe('util/cache/repository/index', () => {
  beforeEach(() => {
    repositoryCache.resetCache();
    jest.resetAllMocks();
    GlobalConfig.set({ cacheDir: '/tmp/renovate/cache/' });
  });

  const config: RenovateConfig = {
    platform: 'github',
    repository: 'abc/def',
    repositoryCache: 'enabled',
  };

  const repoCache: RepoCacheRecord = {
    revision: 11,
    repository: 'abc/def',
    data: {},
  };

  it('returns if cache not enabled', async () => {
    await initRepoCache({
      ...config,
      repositoryCache: 'disabled',
    });
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('resets if repository does not match', async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        ...repoCache,
        repository: 'foo/bar',
        data: { semanticCommits: 'enabled' },
      }) as never
    );

    await initRepoCache(config);

    expect(repositoryCache.getCache()).toEqual({});
  });

  it('reads from cache and finalizes', async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        ...repoCache,
        data: { semanticCommits: 'enabled' },
      }) as never
    );

    await initRepoCache(config);

    expect(fs.readFile).toHaveBeenCalled();

    const cache = repositoryCache.getCache();
    expect(cache).toEqual({ semanticCommits: 'enabled' });

    cache.semanticCommits = 'disabled';
    await repositoryCache.saveCache();
    expect(fs.outputFile).toHaveBeenCalledWith(
      '/tmp/renovate/cache/renovate/repository/github/abc/def.json',
      JSON.stringify({
        revision: 11,
        repository: 'abc/def',
        data: { semanticCommits: 'disabled' },
      })
    );
  });

  it('migrates from 10 to 11 revision', async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        revision: 10,
        repository: 'abc/def',
        semanticCommits: 'enabled',
      }) as never
    );

    await initRepoCache(config);

    const cache = repositoryCache.getCache();
    expect(cache).toEqual({ semanticCommits: 'enabled' });

    cache.semanticCommits = 'disabled';
    await repositoryCache.saveCache();
    expect(fs.outputFile).toHaveBeenCalledWith(
      '/tmp/renovate/cache/renovate/repository/github/abc/def.json',
      JSON.stringify({
        revision: 11,
        repository: 'abc/def',
        data: { semanticCommits: 'disabled' },
      })
    );
  });

  it('does not migrate from older revisions to 11', async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        revision: 9,
        repository: 'abc/def',
        semanticCommits: 'enabled',
      }) as never
    );

    await initRepoCache(config);

    const cache = repositoryCache.getCache();
    expect(cache).toEqual({});
  });

  it('returns empty cache for non-initialized cache', () => {
    expect(repositoryCache.getCache()).toEqual({});
  });

  it('returns empty cache after initialization error', async () => {
    fs.readFile.mockRejectedValueOnce(new Error('unknown error'));
    await initRepoCache(config);
    const cache = repositoryCache.getCache();
    expect(cache).toEqual({});
  });
});
