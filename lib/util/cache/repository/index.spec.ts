import * as _fs from 'fs-extra';
import { mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import type { RepoCache } from './types';
import * as repositoryCache from '.';

jest.mock('fs-extra');

const fs = mocked(_fs);

describe('util/cache/repository/index', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    GlobalConfig.set({ cacheDir: '/tmp/renovate/cache/' });
  });

  const config: RenovateConfig = {
    platform: 'github',
    repository: 'abc/def',
  };

  const repoCache: RepoCache = {
    revision: 11,
    repository: 'abc/def',
    data: {},
  };

  it('catches and silently returns', async () => {
    fs.readFile.mockRejectedValueOnce(new Error('unknown error'));
    await repositoryCache.initialize(config);
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('returns if cache not enabled', async () => {
    await repositoryCache.initialize({
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

    await repositoryCache.initialize({
      ...config,
      repositoryCache: 'enabled',
    });

    expect(repositoryCache.getCache()).toEqual({});
  });

  it('resets if revision does not match', async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        ...repoCache,
        revision: repoCache.revision - 1,
        data: { semanticCommits: 'enabled' },
      }) as never
    );

    await repositoryCache.initialize({
      ...config,
      repositoryCache: 'enabled',
    });

    expect(repositoryCache.getCache()).toEqual({});
  });

  it('reads from cache and finalizes', async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        ...repoCache,
        data: { semanticCommits: 'enabled' },
      }) as never
    );

    await repositoryCache.initialize({
      ...config,
      repositoryCache: 'enabled',
    });

    expect(fs.readFile).toHaveBeenCalled();

    const cache = repositoryCache.getCache();
    expect(cache).toEqual({ semanticCommits: 'enabled' });

    cache.semanticCommits = 'disabled';
    await repositoryCache.finalize();
    expect(fs.outputFile).toHaveBeenCalledWith(
      '/tmp/renovate/cache/renovate/repository/github/abc/def.json',
      JSON.stringify({
        revision: 11,
        repository: 'abc/def',
        data: { semanticCommits: 'disabled' },
      })
    );
  });

  it('gets', () => {
    expect(repositoryCache.getCache()).toEqual({});
  });
});
