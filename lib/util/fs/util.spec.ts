import { resolve } from 'upath';
import { GlobalConfig } from '../../config/global';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../constants/error-messages';
import { ensureCachePath, ensureLocalPath } from './util';

describe('util/fs/util', () => {
  const localDir = resolve('/foo');
  const cacheDir = resolve('/bar');

  beforeAll(() => {
    GlobalConfig.set({ localDir, cacheDir });
  });

  test.each`
    path      | fullPath
    ${''}     | ${`${localDir}`}
    ${'baz'}  | ${`${localDir}/baz`}
    ${'/baz'} | ${`${localDir}/baz`}
  `(`ensureLocalPath('$path') === '$fullPath'`, ({ path, fullPath }) => {
    expect(ensureLocalPath(path)).toBe(resolve(fullPath));
  });

  test.each`
    path
    ${'..'}
    ${'../etc/passwd'}
    ${'/foo/../bar'}
    ${'/foo/../../etc/passwd'}
  `(`ensureLocalPath('$path') - throws`, ({ path }) => {
    expect(() => ensureLocalPath(path, true)).toThrow(
      FILE_ACCESS_VIOLATION_ERROR
    );
  });

  test.each`
    path      | fullPath
    ${''}     | ${`${cacheDir}`}
    ${'baz'}  | ${`${cacheDir}/baz`}
    ${'/baz'} | ${`${cacheDir}/baz`}
  `(`ensureCachePath('$path') === '$fullPath'`, ({ path, fullPath }) => {
    expect(ensureCachePath(path)).toBe(resolve(fullPath));
  });

  test.each`
    path
    ${'..'}
    ${'../etc/passwd'}
    ${'/bar/../foo'}
    ${'/bar/../../etc/passwd'}
  `(`ensureCachePath('$path') - throws`, ({ path }) => {
    expect(() => ensureCachePath(path, true)).toThrow(
      FILE_ACCESS_VIOLATION_ERROR
    );
  });
});
