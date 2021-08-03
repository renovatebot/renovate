import { exec, mockExecAll } from '../../../../test/exec-util';
import { fs, getName } from '../../../../test/util';
import { setAdminConfig } from '../../../config/admin';
import {
  ensureCachedTmpDir,
  getCachedTmpDirId,
  purgeCachedTmpDirs,
  resetCachedTmpDirId,
} from './cache';

jest.mock('child_process');

jest.mock('../../../util/fs');

describe(getName(), () => {
  const tmpVolumeId = '0123456789abcdef';

  beforeEach(() => {
    jest.resetAllMocks();
    resetCachedTmpDirId(tmpVolumeId);
  });

  describe('getCachedTmpDirId', () => {
    it('returns new volume after reset', () => {
      resetCachedTmpDirId();
      const res1 = getCachedTmpDirId();
      resetCachedTmpDirId();
      const res2 = getCachedTmpDirId();
      expect(res1).not.toEqual(res2);
    });

    it('preserves same volume name until reset', () => {
      resetCachedTmpDirId('foo');
      const res1 = getCachedTmpDirId();
      const res2 = getCachedTmpDirId();
      resetCachedTmpDirId('bar');
      const res3 = getCachedTmpDirId();

      expect(res1).toBe('foo');
      expect(res2).toBe('foo');
      expect(res3).toBe('bar');
    });
  });

  describe('purgeCachedTmpDirs', () => {
    it('removes volume cache', async () => {
      const execSnapshots = mockExecAll(exec);

      setAdminConfig({
        binarySource: 'docker',
        dockerCache: 'volume',
      });
      await purgeCachedTmpDirs();

      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker volume prune --force --filter label=renovate=renovate_tmpdir_cache',
        },
      ]);
    });

    it('removes volumes from custom namespaces', async () => {
      const execSnapshots = mockExecAll(exec);

      setAdminConfig({
        binarySource: 'docker',
        dockerCache: 'volume',
        dockerChildPrefix: 'custom_prefix_',
      });
      await purgeCachedTmpDirs();

      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker volume prune --force --filter label=renovate=custom_prefix_tmpdir_cache',
        },
      ]);
    });

    it('removes cache directory', async () => {
      fs.exists.mockResolvedValue(true);
      const execSnapshots = mockExecAll(exec);

      setAdminConfig({
        binarySource: 'docker',
        cacheDir: '/foo/bar',
        dockerCache: 'mount',
      });
      await purgeCachedTmpDirs();

      expect(execSnapshots).toBeEmpty();
      expect(fs.remove).toHaveBeenCalledWith('/foo/bar/renovate_tmpdir_cache');
    });

    it('removes cache root in non-Docker environment', async () => {
      fs.exists.mockResolvedValue(true);
      const execSnapshots = mockExecAll(exec);

      setAdminConfig({
        binarySource: 'global',
        cacheDir: '/foo/bar',
        dockerCache: 'mount',
      });
      await purgeCachedTmpDirs();

      expect(execSnapshots).toBeEmpty();
      expect(fs.remove).toHaveBeenCalledWith('/foo/bar/renovate_tmpdir_cache');
    });
  });

  it('removes cache directory with custom namespace', async () => {
    fs.exists.mockResolvedValue(true);
    const execSnapshots = mockExecAll(exec);

    setAdminConfig({
      binarySource: 'docker',
      cacheDir: '/foo/bar',
      dockerCache: 'mount',
      dockerChildPrefix: 'custom_prefix_',
    });
    await purgeCachedTmpDirs();

    expect(execSnapshots).toBeEmpty();
    expect(fs.remove).toHaveBeenCalledWith(
      '/foo/bar/custom_prefix_tmpdir_cache'
    );
  });

  it('handles errors while removing cache directory', async () => {
    fs.exists.mockResolvedValue(true);

    fs.remove.mockRejectedValueOnce('unknown');

    fs.stat.mockResolvedValueOnce({ isDirectory: () => true } as never);
    fs.stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    } as never);

    fs.readdir.mockResolvedValueOnce(['foo', 'bar']);

    fs.chmod.mockResolvedValueOnce();
    fs.chmod.mockResolvedValueOnce();
    fs.chmod.mockRejectedValueOnce('unknown');

    fs.remove.mockResolvedValueOnce();

    const execSnapshots = mockExecAll(exec);

    setAdminConfig({
      binarySource: 'docker',
      cacheDir: '/foo/bar',
      dockerCache: 'mount',
    });
    await purgeCachedTmpDirs();

    expect(execSnapshots).toBeEmpty();
    expect(fs.remove).toHaveBeenNthCalledWith(
      1,
      '/foo/bar/renovate_tmpdir_cache'
    );
    expect(fs.remove).toHaveBeenNthCalledWith(
      2,
      '/foo/bar/renovate_tmpdir_cache'
    );

    expect(fs.chmod).toHaveBeenNthCalledWith(
      1,
      '/foo/bar/renovate_tmpdir_cache',
      '755'
    );
    expect(fs.chmod).toHaveBeenNthCalledWith(
      2,
      '/foo/bar/renovate_tmpdir_cache/foo',
      '644'
    );
    expect(fs.chmod).toHaveBeenNthCalledWith(
      3,
      '/foo/bar/renovate_tmpdir_cache/bar',
      '644'
    );
  });

  describe('ensureCachedTmpDir', () => {
    it('creates new volume', async () => {
      const execSnapshots = mockExecAll(exec);

      setAdminConfig({
        binarySource: 'docker',
        dockerCache: 'volume',
      });
      await ensureCachedTmpDir();

      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker volume create --label renovate=renovate_tmpdir_cache renovate_tmpdir_cache_0123456789abcdef',
        },
      ]);
    });

    it('creates volumes within custom namespace', async () => {
      const execSnapshots = mockExecAll(exec);

      setAdminConfig({
        binarySource: 'docker',
        dockerCache: 'volume',
        dockerChildPrefix: 'custom_prefix_',
      });
      await ensureCachedTmpDir();

      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker volume create --label renovate=custom_prefix_tmpdir_cache custom_prefix_tmpdir_cache_0123456789abcdef',
        },
      ]);
    });

    it('creates cache root in Docker environment', async () => {
      const expected = `renovate_tmpdir_cache/${tmpVolumeId}`;
      const execSnapshots = mockExecAll(exec);
      fs.ensureCacheDir.mockResolvedValueOnce(`/foo/bar/${expected}` as never);

      setAdminConfig({
        binarySource: 'docker',
        cacheDir: '/foo/bar',
        dockerCache: 'mount',
      });

      await ensureCachedTmpDir();

      expect(execSnapshots).toBeEmpty();
      expect(fs.ensureCacheDir).toHaveBeenCalledWith(expected);
    });
  });

  it('creates cache root in non-Docker environment', async () => {
    const expected = `renovate_tmpdir_cache/${tmpVolumeId}`;
    const execSnapshots = mockExecAll(exec);

    setAdminConfig({
      binarySource: 'global',
      cacheDir: '/foo/bar',
      dockerCache: 'mount',
    });
    await ensureCachedTmpDir();

    expect(execSnapshots).toBeEmpty();
    expect(fs.ensureCacheDir).toHaveBeenCalledWith(expected);
  });
});
