import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../constants/error-messages';
import { ensureCachePath, ensureLocalPath, isValidPath } from './util';

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
});
