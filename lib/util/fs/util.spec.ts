import { GlobalConfig } from '../../config/global';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../constants/error-messages';
import { ensureCachePath, ensureLocalPath } from './util';

describe('util/fs/util', () => {
  const localDir = '/foo';
  const cacheDir = '/bar';

  beforeAll(() => {
    GlobalConfig.set({ localDir, cacheDir });
  });

  test.each`
    path             | fullPath
    ${''}            | ${`${localDir}`}
    ${'baz'}         | ${`${localDir}/baz`}
    ${'/baz'}        | ${`${localDir}/baz`}
    ${'/foo/../bar'} | ${`${localDir}/bar`}
  `(`ensureLocalPath('$path', '$fullPath')`, ({ path, fullPath }) => {
    expect(ensureLocalPath(path)).toBe(fullPath);
  });

  test.each`
    path
    ${'..'}
    ${'../etc/passwd'}
    ${'/foo/../../etc/passwd'}
  `(`ensureLocalPath('$path', '${localDir}') - throws`, ({ path }) => {
    expect(() => ensureLocalPath(path)).toThrow(FILE_ACCESS_VIOLATION_ERROR);
  });

  test.each`
    path             | fullPath
    ${''}            | ${`${cacheDir}`}
    ${'baz'}         | ${`${cacheDir}/baz`}
    ${'/baz'}        | ${`${cacheDir}/baz`}
    ${'/foo/../bar'} | ${`${cacheDir}/bar`}
  `(`ensureCachePath('$path', '$fullPath')`, ({ path, fullPath }) => {
    expect(ensureCachePath(path)).toBe(fullPath);
  });

  test.each`
    path
    ${'..'}
    ${'../etc/passwd'}
    ${'/bar/../../etc/passwd'}
  `(`ensureCachePath('$path', '${cacheDir}') - throws`, ({ path }) => {
    expect(() => ensureCachePath(path)).toThrow(FILE_ACCESS_VIOLATION_ERROR);
  });
});
