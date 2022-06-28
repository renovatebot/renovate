import _findUp from 'find-up';
import { withDir } from 'tmp-promise';
import { join } from 'upath';
import { envMock } from '../../../test/exec-util';
import { env, mockedFunction } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import {
  chmodLocalFile,
  ensureCacheDir,
  ensureLocalDir,
  exists,
  findLocalSiblingOrParent,
  findUpLocal,
  getSubDirectory,
  localPathExists,
  localPathIsFile,
  readLocalDirectory,
  readLocalFile,
  statLocalFile,
  writeLocalFile,
} from '.';

jest.mock('../exec/env');
jest.mock('find-up');

const findUp = mockedFunction(_findUp);

describe('util/fs/index', () => {
  describe('readLocalFile', () => {
    beforeEach(() => {
      GlobalConfig.set({ localDir: '' });
    });

    it('reads buffer', async () => {
      expect(await readLocalFile(__filename)).toBeInstanceOf(Buffer);
    });

    it('reads string', async () => {
      expect(typeof (await readLocalFile(__filename, 'utf8'))).toBe('string');
    });

    it('does not throw', async () => {
      // Does not work on FreeBSD: https://nodejs.org/docs/latest-v10.x/api/fs.html#fs_fs_readfile_path_options_callback
      expect(await readLocalFile(__dirname)).toBeNull();
    });
  });

  describe('localPathExists', () => {
    it('returns true for file', async () => {
      expect(await localPathExists(__filename)).toBeTrue();
    });

    it('returns true for directory', async () => {
      expect(await localPathExists(getSubDirectory(__filename))).toBeTrue();
    });

    it('returns false', async () => {
      expect(await localPathExists(__filename.replace('.ts', '.txt'))).toBe(
        false
      );
    });
  });

  describe('findLocalSiblingOrParent', () => {
    it('returns path for file', async () => {
      await withDir(
        async (localDir) => {
          GlobalConfig.set({
            localDir: localDir.path,
          });

          await writeLocalFile('crates/one/Cargo.toml', '');
          await writeLocalFile('Cargo.lock', '');

          expect(
            await findLocalSiblingOrParent(
              'crates/one/Cargo.toml',
              'Cargo.lock'
            )
          ).toBe('Cargo.lock');
          expect(
            await findLocalSiblingOrParent(
              'crates/one/Cargo.toml',
              'Cargo.mock'
            )
          ).toBeNull();

          await writeLocalFile('crates/one/Cargo.lock', '');

          expect(
            await findLocalSiblingOrParent(
              'crates/one/Cargo.toml',
              'Cargo.lock'
            )
          ).toBe('crates/one/Cargo.lock');
          expect(
            await findLocalSiblingOrParent('crates/one', 'Cargo.lock')
          ).toBe('Cargo.lock');
          expect(
            await findLocalSiblingOrParent(
              'crates/one/Cargo.toml',
              'Cargo.mock'
            )
          ).toBeNull();
        },
        {
          unsafeCleanup: true,
        }
      );
    });

    it('immediately returns null when either path is absolute', async () => {
      expect(await findLocalSiblingOrParent('/etc/hosts', 'other')).toBeNull();
      expect(await findLocalSiblingOrParent('other', '/etc/hosts')).toBeNull();
    });
  });

  describe('readLocalDirectory', () => {
    it('returns dir content', async () => {
      await withDir(
        async (localDir) => {
          GlobalConfig.set({
            localDir: localDir.path,
          });
          await writeLocalFile('test/Cargo.toml', '');
          await writeLocalFile('test/Cargo.lock', '');

          const result = await readLocalDirectory('test');
          expect(result).not.toBeNull();
          expect(result).toBeArrayOfSize(2);
          expect(result).toMatchSnapshot();

          await writeLocalFile('Cargo.lock', '');
          await writeLocalFile('/test/subdir/Cargo.lock', '');

          const resultWithAdditionalFiles = await readLocalDirectory('test');
          expect(resultWithAdditionalFiles).not.toBeNull();
          expect(resultWithAdditionalFiles).toBeArrayOfSize(3);
          expect(resultWithAdditionalFiles).toMatchSnapshot();
        },
        {
          unsafeCleanup: true,
        }
      );
    });

    it('return empty array for non existing directory', async () => {
      await withDir(
        async (localDir) => {
          GlobalConfig.set({
            localDir: localDir.path,
          });
          await expect(readLocalDirectory('somedir')).rejects.toThrow();
        },
        {
          unsafeCleanup: true,
        }
      );
    });

    it('return empty array for a existing but empty directory', async () => {
      await ensureLocalDir('somedir');
      const result = await readLocalDirectory('somedir');
      expect(result).not.toBeNull();
      expect(result).toBeArrayOfSize(0);
    });
  });

  describe('ensureCacheDir', () => {
    function setupMock(root: string): {
      dirFromEnv: string;
      dirFromConfig: string;
    } {
      const dirFromEnv = join(root, join('/bar/others/bundler'));
      const dirFromConfig = join(root, join('/bar'));

      jest.resetAllMocks();
      env.getChildProcessEnv.mockReturnValueOnce({
        ...envMock.basic,
      });

      GlobalConfig.set({
        cacheDir: join(dirFromConfig),
      });

      return { dirFromEnv, dirFromConfig };
    }

    it('prefers environment variables over global config', async () => {
      await withDir(
        async (tmpDir) => {
          const { dirFromEnv } = setupMock(tmpDir.path);
          const res = await ensureCacheDir('bundler');
          expect(res).toEqual(dirFromEnv);
          expect(await exists(dirFromEnv)).toBeTrue();
        },
        { unsafeCleanup: true }
      );
    });
  });

  describe('localPathIsFile', () => {
    beforeEach(() => {
      GlobalConfig.set({ localDir: '' });
    });

    it('returns true for file', async () => {
      expect(await localPathIsFile(__filename)).toBeTrue();
    });

    it('returns false for directory', async () => {
      expect(await localPathIsFile(__dirname)).toBeFalse();
    });

    it('returns false for non-existing path', async () => {
      expect(
        await localPathIsFile(__filename.replace('.ts', '.txt'))
      ).toBeFalse();
    });
  });

  describe('findUpLocal', () => {
    beforeEach(() => {
      GlobalConfig.set({ localDir: '/abs/path/to/local/dir' });
    });

    it('returns relative path for file', async () => {
      findUp.mockResolvedValueOnce('/abs/path/to/local/dir/subdir/file.json');
      const res = await findUpLocal('file.json', 'subdir/subdir2');
      expect(res).toBe('subdir/file.json');
    });

    it('returns null if nothing found', async () => {
      findUp.mockResolvedValueOnce(undefined);
      const res = await findUpLocal('file.json', 'subdir/subdir2');
      expect(res).toBeNull();
    });

    it('returns undefined if found a file outside of localDir', async () => {
      findUp.mockResolvedValueOnce('/abs/path/to/file.json');
      const res = await findUpLocal('file.json', 'subdir/subdir2');
      expect(res).toBeNull();
    });
  });

  describe('chmodLocalFile', () => {
    it('works', async () => {
      await withDir(
        async (tmpDir) => {
          GlobalConfig.set({ localDir: tmpDir.path });
          await writeLocalFile('foo', 'bar');
          await chmodLocalFile('foo', 0o000);
          expect(await readLocalFile('foo')).toBeNull();
          await chmodLocalFile('foo', 0o444);
          expect((await readLocalFile('foo'))!.toString()).toBe('bar');
        },
        { unsafeCleanup: true }
      );
    });
  });

  describe('statLocalFile', () => {
    it('works', async () => {
      await withDir(
        async (tmpDir) => {
          GlobalConfig.set({ localDir: tmpDir.path });

          expect(await statLocalFile('foo')).toBeNull();

          await writeLocalFile('foo', 'bar');
          await chmodLocalFile('foo', 0o123);

          const res = await statLocalFile('foo');
          expect(res!.isFile()).toBeTrue();
          expect(res!.mode & 0o777).toBe(0o123);
        },
        { unsafeCleanup: true }
      );
    });
  });
});
