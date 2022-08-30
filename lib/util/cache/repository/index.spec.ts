import { mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import * as _fs from '../../fs';
import { initRepoCache } from './init';
import type { RepoCacheConfig } from './types';
import { getCache, resetCache, saveCache } from '.';

jest.mock('../../fs');

const fs = mocked(_fs);

describe('util/cache/repository/index', () => {
  beforeEach(() => {
    resetCache();
    jest.resetAllMocks();
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
  });

  it('saves cache', async () => {
    await initRepoCache({ ...config, repositoryCache: 'enabled' });
    await saveCache();
    expect(fs.outputCacheFile).toHaveBeenCalled();
  });

  it('resets cache', async () => {
    await initRepoCache({ ...config, repositoryCache: 'reset' });
    expect(fs.readCacheFile).not.toHaveBeenCalled();
    expect(fs.outputCacheFile).toHaveBeenCalled();
    expect(getCache()).toBeEmpty();
  });
});
