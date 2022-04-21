import { fs } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { CACHE_REVISION } from '../common';
import type { RepoCacheData, RepoCacheRecord } from '../types';
import { LocalRepoCache } from './local';

jest.mock('../../../fs');

describe('util/cache/repository/impl/local', () => {
  beforeEach(() => {
    GlobalConfig.set({ cacheDir: '/tmp/cache' });
  });

  it('returns empty object before any data load', () => {
    const localRepoCache = new LocalRepoCache('github', 'some/repo');
    expect(localRepoCache.getData()).toBeEmpty();
  });

  it('loads valid cache from disk', async () => {
    const data: RepoCacheData = { semanticCommits: 'enabled' };
    const cache: RepoCacheRecord = {
      repository: 'some/repo',
      revision: CACHE_REVISION,
      data,
    };
    fs.readFile.mockResolvedValue(JSON.stringify(cache));
    const localRepoCache = new LocalRepoCache('github', 'some/repo');

    await localRepoCache.load();

    expect(localRepoCache.getData()).toEqual(data);
  });

  it('migrates revision from 10 to 11', async () => {
    fs.readFile.mockResolvedValue(
      JSON.stringify({
        revision: 10,
        repository: 'some/repo',
        semanticCommits: 'enabled',
      })
    );
    const localRepoCache = new LocalRepoCache('github', 'some/repo');
    await localRepoCache.load();

    await localRepoCache.save();

    expect(fs.outputFile).toHaveBeenCalledWith(
      '/tmp/cache/renovate/repository/github/some/repo.json',
      JSON.stringify({
        revision: CACHE_REVISION,
        repository: 'some/repo',
        data: { semanticCommits: 'enabled' },
      })
    );
  });

  it('does not migrate from older revisions to 11', async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        revision: 9,
        repository: 'some/repo',
        semanticCommits: 'enabled',
      })
    );

    const localRepoCache = new LocalRepoCache('github', 'some/repo');
    await localRepoCache.load();

    expect(localRepoCache.getData()).toBeEmpty();
  });

  it('handles invalid data', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ foo: 'bar' }));
    const localRepoCache = new LocalRepoCache('github', 'some/repo');

    await localRepoCache.load();

    expect(await localRepoCache.getData()).toBeEmpty();
  });

  it('handles file read error', async () => {
    fs.readFile.mockRejectedValue(new Error('unknown error'));
    const localRepoCache = new LocalRepoCache('github', 'some/repo');

    await localRepoCache.load();

    const data = localRepoCache.getData();
    expect(data).toBeEmpty();
  });

  it('resets if repository does not match', async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        revision: CACHE_REVISION,
        repository: 'foo/bar',
        data: { semanticCommits: 'enabled' },
      }) as never
    );

    const localRepoCache = new LocalRepoCache('github', 'some/repo');
    await localRepoCache.load();

    expect(localRepoCache.getData()).toEqual({});
  });

  it('saves cache data to file', async () => {
    fs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        revision: CACHE_REVISION,
        repository: 'some/repo',
        data: { semanticCommits: 'enabled' },
      })
    );
    const localRepoCache = new LocalRepoCache('github', 'some/repo');
    await localRepoCache.load();

    const data = localRepoCache.getData();
    data.semanticCommits = 'disabled';
    await localRepoCache.save();

    expect(fs.outputFile).toHaveBeenCalledWith(
      '/tmp/cache/renovate/repository/github/some/repo.json',
      JSON.stringify({
        revision: CACHE_REVISION,
        repository: 'some/repo',
        data: { semanticCommits: 'disabled' },
      })
    );
  });
});
