import { GlobalConfig } from '../../config/global';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../constants/error-messages';
import { ensureCachePath, ensureLocalPath } from './util';

describe('util/fs/util', () => {
  test.each`
    path      | fullPath
    ${''}     | ${'/foo'}
    ${'baz'}  | ${'/foo/baz'}
    ${'/baz'} | ${'/foo/baz'}
  `(`ensureLocalPath('$path', '$fullPath')`, ({ path, fullPath }) => {
    GlobalConfig.set({ localDir: '/foo' });
    expect(ensureLocalPath(path)).toBe(fullPath);
  });

  test.each`
    path      | fullPath
    ${''}     | ${'/foo'}
    ${'baz'}  | ${'/foo/baz'}
    ${'/baz'} | ${'/foo/baz'}
  `(`ensureCachePath('$path', '$fullPath')`, ({ path, fullPath }) => {
    GlobalConfig.set({ cacheDir: '/foo' });
    expect(ensureCachePath(path)).toBe(fullPath);
  });

  it('throws FILE_ACCESS_VIOLATION_ERROR', () => {
    GlobalConfig.set({ localDir: '/foo', cacheDir: '/bar' });
    expect(() => ensureLocalPath('..')).toThrow(FILE_ACCESS_VIOLATION_ERROR);
    expect(() => ensureCachePath('..')).toThrow(FILE_ACCESS_VIOLATION_ERROR);
  });
});
