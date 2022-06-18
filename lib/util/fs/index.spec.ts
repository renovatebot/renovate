import _findUp from 'find-up';
import { withDir } from 'tmp-promise';
import { join } from 'upath';
import { envMock } from '../../../test/exec-util';
import { env, mockedFunction } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import {
  deleteLocalFile,
  ensureCacheDir,
  exists,
  findLocalSiblingOrParent,
  findUpLocal,
  getSubDirectory,
  localPathExists,
  localPathIsFile,
  readLocalFile,
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

    it('blocks path traversal attempt', async () => {
      GlobalConfig.set({ localDir: 'some/invalid/dir' });
      expect(await readLocalFile('../filename')).toBeNull();
    });
  });

  describe('writeLocalFile', () => {
    it('blocks path traversal attempt', async () => {
      GlobalConfig.set({ localDir: 'some/invalid/dir' });
      expect(await writeLocalFile('../filename', '')).toBeUndefined();
    });
  });

  describe('deleteLocalFile', () => {
    it('blocks path traversal attempt', async () => {
      GlobalConfig.set({ localDir: 'some/invalid/dir' });
      expect(await deleteLocalFile('../filename')).toBeUndefined();
    });
  });

  describe('localPathExists', () => {
    it('returns true for file', async () => {
      GlobalConfig.set({ localDir: '' });
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

    it('blocks path traversal attempt', async () => {
      GlobalConfig.set({ localDir: 'some/invalid/dir' });
      expect(await localPathExists('../filename')).toBeFalse();
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

    it('blocks path traversal attempt', async () => {
      GlobalConfig.set({ cacheDir: join('some/invalid/dir') });
      await expect(ensureCacheDir('../../filename')).toReject();
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

    it('blocks path traversal attempt', async () => {
      GlobalConfig.set({ localDir: 'some/invalid/dir' });
      expect(await localPathIsFile('../filename')).toBeFalse();
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
});
