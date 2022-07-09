import _findUp from 'find-up';
import fs from 'fs-extra';
import tmp, { DirectoryResult } from 'tmp-promise';
import { join } from 'upath';
import { envMock } from '../../../test/exec-util';
import { env, mockedFunction } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import {
  chmodLocalFile,
  createCacheWriteStream,
  deleteLocalFile,
  ensureCacheDir,
  ensureDir,
  ensureLocalDir,
  findLocalSiblingOrParent,
  findUpLocal,
  getParentDir,
  getSiblingFileName,
  listCacheDir,
  localPathExists,
  localPathIsFile,
  outputCacheFile,
  privateCacheDir,
  readCacheFile,
  readLocalBlob,
  readLocalDirectory,
  readLocalFile,
  readSystemFile,
  renameLocalFile,
  rmCache,
  statLocalFile,
  writeLocalFile,
} from '.';

jest.mock('../exec/env');
jest.mock('find-up');

const findUp = mockedFunction(_findUp);

describe('util/fs/index', () => {
  let dirResult: DirectoryResult;
  let tmpDir: string;

  beforeEach(async () => {
    GlobalConfig.set({ localDir: '' });
    dirResult = await tmp.dir({ unsafeCleanup: true });
    tmpDir = dirResult.path;
  });

  afterEach(async () => {
    await dirResult.cleanup();
  });

  describe('getParentDir', () => {
    test.each`
      dir            | expected
      ${'/foo/bar/'} | ${'/foo'}
      ${'/foo/bar'}  | ${'/foo'}
      ${'/foo/'}     | ${'/'}
      ${'/foo'}      | ${'/'}
      ${'foo/bar/'}  | ${'foo'}
      ${'foo/bar'}   | ${'foo'}
      ${'foo/'}      | ${''}
      ${'foo'}       | ${''}
      ${''}          | ${''}
      ${'.'}         | ${''}
      ${'..'}        | ${''}
      ${'./foo'}     | ${'.'}
      ${'../foo'}    | ${'..'}
    `(`('$dir') -> '$expected'`, ({ dir, expected }) => {
      expect(getParentDir(dir)).toBe(expected);
    });
  });

  describe('getSiblingFileName', () => {
    test.each`
      file          | sibling  | expected
      ${'/foo/bar'} | ${'baz'} | ${'/foo/baz'}
      ${'foo/bar'}  | ${'baz'} | ${'foo/baz'}
      ${'foo/'}     | ${'baz'} | ${'baz'}
      ${'foo'}      | ${'baz'} | ${'baz'}
      ${'./foo'}    | ${'baz'} | ${'baz'}
      ${'../foo'}   | ${'baz'} | ${'../baz'}
    `(`('$file', '$sibling') -> '$expected'`, ({ file, sibling, expected }) => {
      expect(getSiblingFileName(file, sibling)).toBe(expected);
    });
  });

  describe('readLocalFile', () => {
    it('reads buffer', async () => {
      expect(await readLocalBlob(__filename)).toBeInstanceOf(Buffer);
    });

    it('reads string', async () => {
      expect(typeof (await readLocalFile(__filename))).toBe('string');
    });

    it('does not throw', async () => {
      // Does not work on FreeBSD: https://nodejs.org/docs/latest-v10.x/api/fs.html#fs_fs_readfile_path_options_callback
      expect(await readLocalFile(__dirname)).toBeNull();
    });
  });

  describe('writeLocalFile', () => {
    it('outputs file', async () => {
      const localDir = tmpDir;
      GlobalConfig.set({ localDir });
      await writeLocalFile('foo/bar/file.txt', 'foobar');

      const path = `${localDir}/foo/bar/file.txt`;
      expect(await fs.pathExists(path)).toBeTrue();
      expect(await fs.readFile(path, 'utf8')).toBe('foobar');
    });
  });

  describe('deleteLocalFile', () => {
    it('deletes file', async () => {
      const localDir = tmpDir;
      GlobalConfig.set({ localDir });
      const filePath = `${localDir}/foo/bar/file.txt`;
      await fs.outputFile(filePath, 'foobar');

      expect(await fs.pathExists(filePath)).toBeTrue();
      await deleteLocalFile('foo/bar/file.txt');
      expect(await fs.pathExists(filePath)).toBeFalse();
    });
  });

  describe('renameLocalFile', () => {
    it('renames file', async () => {
      const localDir = tmpDir;
      GlobalConfig.set({ localDir });
      const sourcePath = `${localDir}/foo.txt`;
      const targetPath = `${localDir}/bar.txt`;
      await fs.outputFile(sourcePath, 'foobar');

      expect(await fs.pathExists(sourcePath)).toBeTrue();
      expect(await fs.pathExists(targetPath)).toBeFalse();
      await renameLocalFile('foo.txt', 'bar.txt');
      expect(await fs.pathExists(sourcePath)).toBeFalse();
      expect(await fs.pathExists(targetPath)).toBeTrue();
    });
  });

  describe('ensureDir', () => {
    it('creates directory', async () => {
      const localDir = tmpDir;
      GlobalConfig.set({ localDir });
      const path = `${localDir}/foo/bar`;

      await ensureDir(path);
      const stat = await fs.stat(path);
      expect(stat.isDirectory()).toBeTrue();
    });
  });

  describe('ensureLocalDir', () => {
    it('creates local directory', async () => {
      const localDir = tmpDir;
      GlobalConfig.set({ localDir });
      const path = `${localDir}/foo/bar`;

      await ensureLocalDir('foo/bar');
      const stat = await fs.stat(path);
      expect(stat.isDirectory()).toBeTrue();
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
      const { dirFromEnv } = setupMock(tmpDir);
      const res = await ensureCacheDir('bundler');
      expect(res).toEqual(dirFromEnv);
      expect(await fs.pathExists(dirFromEnv)).toBeTrue();
    });
  });

  describe('privateCacheDir', () => {
    it('returns cache dir', () => {
      GlobalConfig.set({ cacheDir: '/tmp/foo/bar' });
      expect(privateCacheDir()).toBe(`/tmp/foo/bar/__renovate-private-cache`);
    });
  });

  describe('localPathExists', () => {
    it('returns true for file', async () => {
      expect(await localPathExists(__filename)).toBeTrue();
    });

    it('returns true for directory', async () => {
      expect(await localPathExists(getParentDir(__filename))).toBeTrue();
    });

    it('returns false', async () => {
      expect(await localPathExists(__filename.replace('.ts', '.txt'))).toBe(
        false
      );
    });
  });

  describe('findLocalSiblingOrParent', () => {
    it('returns path for file', async () => {
      const localDir = tmpDir;
      GlobalConfig.set({ localDir });

      await writeLocalFile('crates/one/Cargo.toml', 'foo');
      await writeLocalFile('Cargo.lock', 'bar');

      expect(
        await findLocalSiblingOrParent('crates/one/Cargo.toml', 'Cargo.lock')
      ).toBe('Cargo.lock');
      expect(
        await findLocalSiblingOrParent('crates/one/Cargo.toml', 'Cargo.mock')
      ).toBeNull();

      await writeLocalFile('crates/one/Cargo.lock', '');

      expect(
        await findLocalSiblingOrParent('crates/one/Cargo.toml', 'Cargo.lock')
      ).toBe('crates/one/Cargo.lock');
      expect(await findLocalSiblingOrParent('crates/one', 'Cargo.lock')).toBe(
        'Cargo.lock'
      );
      expect(
        await findLocalSiblingOrParent('crates/one/Cargo.toml', 'Cargo.mock')
      ).toBeNull();
    });

    it('immediately returns null when either path is absolute', async () => {
      expect(await findLocalSiblingOrParent('/etc/hosts', 'other')).toBeNull();
      expect(await findLocalSiblingOrParent('other', '/etc/hosts')).toBeNull();
    });
  });

  describe('readLocalDirectory', () => {
    it('returns dir content', async () => {
      const localDir = tmpDir;
      GlobalConfig.set({ localDir });
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
    });

    it('return empty array for non existing directory', async () => {
      const localDir = tmpDir;
      GlobalConfig.set({ localDir });
      await expect(readLocalDirectory('somedir')).rejects.toThrow();
    });

    it('return empty array for a existing but empty directory', async () => {
      await ensureLocalDir('somedir');
      const result = await readLocalDirectory('somedir');
      expect(result).not.toBeNull();
      expect(result).toBeArrayOfSize(0);
    });
  });

  describe('createCacheWriteStream', () => {
    it('creates write stream', async () => {
      const path = `${tmpDir}/file.txt`;
      await fs.outputFile(path, 'foo');

      const stream = createCacheWriteStream(path);
      expect(stream).toBeInstanceOf(fs.WriteStream);

      const write = new Promise((resolve, reject) => {
        stream.write('bar');
        stream.close(resolve);
      });
      await write;
      expect(await fs.readFile(path, 'utf8')).toBe('bar');
    });
  });

  describe('localPathIsFile', () => {
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
    it('changes file mode', async () => {
      const localDir = tmpDir;
      GlobalConfig.set({ localDir });
      await writeLocalFile('foo', 'bar');
      let stat = await statLocalFile('foo');
      const oldMode = stat!.mode & 0o777;
      const newMode = oldMode & 0o555; // Remove `write` attributes (Windows-compatible)

      await chmodLocalFile('foo', newMode);
      stat = await statLocalFile('foo');
      expect(stat!.mode & 0o777).toBe(newMode);

      await chmodLocalFile('foo', oldMode);
      stat = await statLocalFile('foo');
      expect(stat!.mode & 0o777).toBe(oldMode);
    });
  });

  describe('statLocalFile', () => {
    it('returns stat object', async () => {
      const localDir = tmpDir;
      GlobalConfig.set({ localDir });

      expect(await statLocalFile('foo')).toBeNull();

      await writeLocalFile('foo', 'bar');
      const stat = await statLocalFile('foo');
      expect(stat).toBeTruthy();
      expect(stat!.isFile()).toBeTrue();
    });
  });

  describe('listCacheDir', () => {
    it('lists directory', async () => {
      const cacheDir = tmpDir;
      GlobalConfig.set({ cacheDir });
      await fs.outputFile(`${cacheDir}/foo/bar.txt`, 'foobar');
      expect(await listCacheDir(`${cacheDir}/foo`)).toEqual(['bar.txt']);
    });
  });

  describe('rmCache', () => {
    it('removes cache dir', async () => {
      const cacheDir = tmpDir;
      GlobalConfig.set({ cacheDir });
      await fs.outputFile(`${cacheDir}/foo/bar/file.txt`, 'foobar');
      await rmCache(`${cacheDir}/foo/bar`);
      expect(await fs.pathExists(`${cacheDir}/foo/bar/file.txt`)).toBeFalse();
      expect(await fs.pathExists(`${cacheDir}/foo/bar`)).toBeFalse();
    });
  });

  describe('readCacheFile', () => {
    it('reads file', async () => {
      const cacheDir = tmpDir;
      GlobalConfig.set({ cacheDir });
      await fs.outputFile(`${cacheDir}/foo/bar/file.txt`, 'foobar');
      expect(await readCacheFile(`${cacheDir}/foo/bar/file.txt`, 'utf8')).toBe(
        'foobar'
      );
      expect(await readCacheFile(`${cacheDir}/foo/bar/file.txt`)).toEqual(
        Buffer.from('foobar')
      );
    });
  });

  describe('outputCacheFile', () => {
    it('outputs file', async () => {
      const file = join(tmpDir, 'some-file');
      await outputCacheFile(file, 'foobar');
      const res = await fs.readFile(file, 'utf8');
      expect(res).toBe('foobar');
    });
  });

  describe('readSystemFile', () => {
    it('reads file', async () => {
      const path = `${tmpDir}/file.txt`;
      await fs.outputFile(path, 'foobar', { encoding: 'utf8' });
      expect(await readSystemFile(path, 'utf8')).toBe('foobar');
      expect(await readSystemFile(path)).toEqual(Buffer.from('foobar'));
    });
  });
});
