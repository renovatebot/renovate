import { fs, logger } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { printRepositoryProblems } from '../../../workers/repository/index.ts';
import { getCache, isCacheModified, resetCache, saveCache } from './index.ts';
import { initRepoCache } from './init.ts';
import type { RepoCacheConfig } from './types.ts';

vi.mock('../../fs/index.ts');

describe('util/cache/repository/index', () => {
  beforeEach(() => {
    resetCache();
    GlobalConfig.set({ cacheDir: '/tmp/cache', platform: 'github' });
  });

  const config: RepoCacheConfig = {
    repository: 'some/repo',
    repositoryCache: 'enabled',
    repoFingerprint: '0123456789abcdef',
  };

  it('returns if cache not enabled', async () => {
    await initRepoCache({ ...config, repositoryCache: 'disabled' });
    expect(fs.readCacheFile).not.toHaveBeenCalled();
    expect(getCache()).toBeEmpty();
    expect(isCacheModified()).toBeUndefined();
  });

  it('saves cache', async () => {
    await initRepoCache({ ...config, repositoryCache: 'enabled' });
    await saveCache();
    expect(fs.outputCacheFile).toHaveBeenCalled();
    expect(isCacheModified()).toBeUndefined();
  });

  it('skips saves cache on dry run', async () => {
    GlobalConfig.set({
      cacheDir: '/tmp/cache',
      platform: 'github',
      dryRun: 'full',
    });
    await initRepoCache({ ...config, repositoryCache: 'enabled' });
    await saveCache();
    expect(fs.outputCacheFile).not.toHaveBeenCalled();
    expect(isCacheModified()).toBeUndefined();
  });

  it('resets cache', async () => {
    await initRepoCache({ ...config, repositoryCache: 'reset' });
    expect(fs.readCacheFile).not.toHaveBeenCalled();
    expect(fs.outputCacheFile).toHaveBeenCalled();
    expect(getCache()).toBeEmpty();
    expect(isCacheModified()).toBeUndefined();
  });

  it('prints repository problems', () => {
    logger.getProblems.mockReturnValueOnce([
      {
        repository: 'some/repo',
        level: 30,
        msg: 'Problem 1',
        artifactErrors: false,
      },
      { repository: 'some/repo', level: 30, msg: 'Problem 2' },
    ]);

    printRepositoryProblems(config.repository);

    expect(logger.logger.debug).toHaveBeenCalled();
  });
});
