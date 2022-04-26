import { mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import * as _fs from '../../fs';
import { initRepoCache } from './init';
import { getCache, resetCache, saveCache } from '.';

jest.mock('../../fs');

const fs = mocked(_fs);

describe('util/cache/repository/index', () => {
  beforeEach(() => {
    resetCache();
    jest.resetAllMocks();
    GlobalConfig.set({ cacheDir: '/tmp/cache' });
  });

  const config: RenovateConfig = {
    platform: 'github',
    repository: 'some/repo',
    repositoryCache: 'enabled',
  };

  it('returns if cache not enabled', async () => {
    await initRepoCache({ ...config, repositoryCache: 'disabled' });
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(getCache()).toBeEmpty();
  });

  it('saves cache', async () => {
    await initRepoCache({ ...config, repositoryCache: 'enabled' });
    await saveCache();
    expect(fs.outputFile).toHaveBeenCalled();
  });
});
