import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../constants/error-messages';
import { ensureCachePath, ensureLocalPath } from './util';

describe('util/fs/util', () => {
  const localDir = upath.resolve('/foo');
  const cacheDir = upath.resolve('/bar');

  beforeAll(() => {
    GlobalConfig.set({ localDir, cacheDir });
  });

  test.each`
    path     | fullPath
    ${''}    | ${`${localDir}`}
    ${'baz'} | ${`${localDir}/baz`}
  `(`ensureLocalPath('$path', '$fullPath')`, ({ path, fullPath }) => {
    expect(ensureLocalPath(path)).toBe(fullPath);
  });

  test.each`
    path
    ${'..'}
    ${'../etc/passwd'}
    ${'/foo/../bar'}
    ${'/foo/../../etc/passwd'}
    ${'/baz'}
  `(`ensureLocalPath('$path', '${localDir}') - throws`, ({ path }) => {
    expect(() => ensureLocalPath(path)).toThrow(FILE_ACCESS_VIOLATION_ERROR);
  });

  test.each`
    path     | fullPath
    ${''}    | ${`${cacheDir}`}
    ${'baz'} | ${`${cacheDir}/baz`}
  `(`ensureCachePath('$path', '$fullPath')`, ({ path, fullPath }) => {
    expect(ensureCachePath(path)).toBe(fullPath);
  });

  test.each`
    path
    ${'..'}
    ${'../etc/passwd'}
    ${'/bar/../foo'}
    ${'/bar/../../etc/passwd'}
    ${'/baz'}
  `(`ensureCachePath('$path', '${cacheDir}') - throws`, ({ path }) => {
    expect(() => ensureCachePath(path)).toThrow(FILE_ACCESS_VIOLATION_ERROR);
  });
});
