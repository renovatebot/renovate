import upath from 'upath';
import { GlobalConfig } from '../../config/global.ts';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../constants/error-messages.ts';
import {
  ensureCachePath,
  ensureLocalPath,
  getMatchingFiles,
  isValidPath,
  resolveRelativePathToRoot,
} from './util.ts';

describe('util/fs/util', () => {
  const localDir = upath.resolve('/foo');
  const cacheDir = upath.resolve('/bar');

  beforeAll(() => {
    GlobalConfig.set({ localDir, cacheDir });
  });

  it.each`
    path     | fullPath
    ${''}    | ${`${localDir}`}
    ${'baz'} | ${`${localDir}/baz`}
  `(`ensureLocalPath('$path', '$fullPath')`, ({ path, fullPath }) => {
    expect(ensureLocalPath(path)).toBe(fullPath);
  });

  it.each`
    path
    ${'..'}
    ${'../etc/passwd'}
    ${'/foo/../bar'}
    ${'/foo/../../etc/passwd'}
    ${'/baz'}
  `(`ensureLocalPath('$path', '${localDir}') - throws`, ({ path }) => {
    expect(() => ensureLocalPath(path)).toThrow(FILE_ACCESS_VIOLATION_ERROR);
  });

  it.each`
    path     | fullPath
    ${''}    | ${`${cacheDir}`}
    ${'baz'} | ${`${cacheDir}/baz`}
  `(`ensureCachePath('$path', '$fullPath')`, ({ path, fullPath }) => {
    expect(ensureCachePath(path)).toBe(fullPath);
  });

  it.each`
    path
    ${'..'}
    ${'../etc/passwd'}
    ${'/bar/../foo'}
    ${'/bar/../../etc/passwd'}
    ${'/baz'}
    ${'/baz"'}
  `(`ensureCachePath('$path', '${cacheDir}') - throws`, ({ path }) => {
    expect(() => ensureCachePath(path)).toThrow(FILE_ACCESS_VIOLATION_ERROR);
  });

  it.each`
    value               | expected
    ${'.'}              | ${true}
    ${'./...'}          | ${true}
    ${'foo'}            | ${true}
    ${'foo/bar'}        | ${true}
    ${'./foo/bar'}      | ${true}
    ${'./foo/bar/...'}  | ${true}
    ${'..'}             | ${false}
    ${'....'}           | ${true}
    ${'./foo/..'}       | ${true}
    ${'./foo/..../bar'} | ${true}
    ${'./..'}           | ${false}
    ${'\\foo'}          | ${false}
    ${"foo'"}           | ${true}
    ${'fo"o'}           | ${true}
    ${'fo&o'}           | ${true}
    ${'f;oo'}           | ${true}
    ${'f o o'}          | ${true}
    ${'/'}              | ${false}
    ${'/foo'}           | ${false}
    ${'&&'}             | ${true}
    ${';'}              | ${true}
    ${'./[foo]/bar'}    | ${true}
  `('isValidPath($value) == $expected', ({ value, expected }) => {
    expect(isValidPath(value, 'cacheDir')).toBe(expected);
  });

  describe('resolveRelativePathToRoot', () => {
    it('resolves relative path from a subdirectory file', () => {
      const result = resolveRelativePathToRoot(
        'two/two.csproj',
        '../one/one.csproj',
      );
      expect(result).toBe('one/one.csproj');
    });

    it('resolves same-directory reference', () => {
      const result = resolveRelativePathToRoot(
        'moduleA/go.mod',
        './local/go.mod',
      );
      expect(result).toBe('moduleA/local/go.mod');
    });

    it('resolves parent directory reference', () => {
      const result = resolveRelativePathToRoot(
        'services/api/go.mod',
        '../../libs/shared',
      );
      expect(result).toBe('libs/shared');
    });

    it('resolves from root-level file', () => {
      const result = resolveRelativePathToRoot('go.mod', './sub');
      expect(result).toBe('sub');
    });

    it('resolves deeply nested paths', () => {
      const result = resolveRelativePathToRoot(
        'a/b/c/file.txt',
        '../../../other/file.txt',
      );
      expect(result).toBe('other/file.txt');
    });
  });

  describe('getMatchingFiles', () => {
    const allFiles = [
      'one/one.csproj',
      'two/two.vbproj',
      'three/three.fsproj',
      'readme.md',
      'go.mod',
      'api/go.mod',
      'cmd/go.mod',
      'go.sum',
      'package.json',
    ];

    it('filters files using minimatch pattern', () => {
      expect(getMatchingFiles('*.{cs,vb,fs}proj', allFiles)).toEqual([
        'one/one.csproj',
        'two/two.vbproj',
        'three/three.fsproj',
      ]);
    });

    it('filters go.mod files', () => {
      expect(getMatchingFiles('go.mod', allFiles)).toEqual([
        'go.mod',
        'api/go.mod',
        'cmd/go.mod',
      ]);
    });

    it('returns empty array when no files match', () => {
      expect(getMatchingFiles('go.mod', ['readme.md', 'package.json'])).toEqual(
        [],
      );
    });
  });
});
