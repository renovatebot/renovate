import _fs from 'fs-extra';
import { withDir } from 'tmp-promise';
import { join } from 'upath';
import { envMock } from '../../../test/exec-util';
import { getName, mocked } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import * as _env from '../exec/env';
import {
  ensureCacheDir,
  ensureLocalDir,
  findLocalSiblingOrParent,
  getSubDirectory,
  localPathExists,
  readLocalDirectory,
  readLocalFile,
  writeLocalFile,
} from '.';

jest.mock('fs-extra');
const fs: jest.Mocked<typeof _fs> = _fs as any;

jest.mock('../../util/exec/env');
const env = mocked(_env);

describe(getName(), () => {
  describe('readLocalFile', () => {
    beforeEach(() => {
      setAdminConfig({ localDir: '' });
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
});

describe(getName(), () => {
  describe('localPathExists', () => {
    it('returns true for file', async () => {
      expect(await localPathExists(__filename)).toBe(true);
    });
    it('returns true for directory', async () => {
      expect(await localPathExists(getSubDirectory(__filename))).toBe(true);
    });
    it('returns false', async () => {
      expect(await localPathExists(__filename.replace('.ts', '.txt'))).toBe(
        false
      );
    });
  });
});

describe(getName(), () => {
  describe('findLocalSiblingOrParent', () => {
    it('returns path for file', async () => {
      await withDir(
        async (localDir) => {
          setAdminConfig({
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
          setAdminConfig({
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
          setAdminConfig({
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
    const dirFromEnv = join('/foo');
    const dirFromConfig = join('/bar');

    beforeEach(() => {
      jest.resetAllMocks();
      env.getChildProcessEnv.mockReturnValueOnce({
        ...envMock.basic,
        CUSTOM_CACHE_DIR: dirFromEnv,
      });
      setAdminConfig({
        cacheDir: join(dirFromConfig),
      });
    });

    it('prefers environment variables over admin config', async () => {
      fs.ensureDir.mockImplementationOnce(() => {});
      const res = await ensureCacheDir('./deeply/nested', 'CUSTOM_CACHE_DIR');
      expect(res).toEqual(dirFromEnv);
      expect(fs.ensureDir).toHaveBeenCalledWith(dirFromEnv);
    });

    it('is optional to pass environment variable', async () => {
      const expected = join(`${dirFromConfig}/deeply/nested`);
      fs.ensureDir.mockImplementationOnce(() => {});
      const res = await ensureCacheDir('./deeply/nested');
      expect(res).toEqual(expected);
      expect(fs.ensureDir).toHaveBeenCalledWith(expected);
    });

    it('falls back to admin config', async () => {
      const expected = join(`${dirFromConfig}/deeply/nested`);
      fs.ensureDir.mockImplementationOnce(() => {});
      const res = await ensureCacheDir('./deeply/nested', 'NO_SUCH_VARIABLE');
      expect(res).toEqual(expected);
      expect(fs.ensureDir).toHaveBeenCalledWith(expected);
    });
  });
});
