import * as _fs from 'fs-extra';
import { getName, mocked } from '../../../../test/util';
import * as repositoryCache from '.';

jest.mock('fs-extra');

const fs = mocked(_fs);

describe(getName(__filename), () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  const config = {
    cacheDir: '/tmp/renovate/cache/',
    platform: 'github',
    repository: 'abc/def',
  };
  it('catches and returns', async () => {
    await repositoryCache.initialize({});
    expect(fs.readFile.mock.calls).toHaveLength(0);
  });
  it('returns if cache not enabled', async () => {
    await repositoryCache.initialize({
      ...config,
      repositoryCache: 'disabled',
    });
    expect(fs.readFile.mock.calls).toHaveLength(0);
  });
  it('resets if invalid', async () => {
    fs.readFile.mockResolvedValueOnce('{}' as any);
    await repositoryCache.initialize({
      ...config,
      repositoryCache: 'enabled',
    });
    expect(repositoryCache.getCache()).toEqual({
      repository: 'abc/def',
      revision: repositoryCache.CACHE_REVISION,
    });
  });
  it('reads from cache and finalizes', async () => {
    fs.readFile.mockResolvedValueOnce(
      `{"repository":"abc/def","revision":${repositoryCache.CACHE_REVISION}}` as any
    );
    await repositoryCache.initialize({
      ...config,
      repositoryCache: 'enabled',
    });
    await repositoryCache.finalize();
    expect(fs.readFile.mock.calls).toHaveLength(1);
    expect(fs.outputFile.mock.calls).toHaveLength(1);
  });
  it('gets', () => {
    expect(repositoryCache.getCache()).toEqual({});
  });
});
