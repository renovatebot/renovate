import type { VariableRegistry } from './types';
import {
  getVars,
  isDependencyString,
  parseDependencyString,
  reorderFiles,
  toAbsolutePath,
  updateVars,
  versionLikeSubstring,
} from './utils';

describe('modules/manager/gradle/utils', () => {
  it('versionLikeSubstring', () => {
    [
      '1.2.3',
      '[1.0,2.0]',
      '(,2.0[',
      '2.1.1.RELEASE',
      '1.0.+',
      '2022-05-10_55',
    ].forEach((input) => {
      expect(versionLikeSubstring(input)).toEqual(input);
      expect(versionLikeSubstring(`${input}'`)).toEqual(input);
      expect(versionLikeSubstring(`${input}"`)).toEqual(input);
      expect(versionLikeSubstring(`${input}\n`)).toEqual(input);
      expect(versionLikeSubstring(`${input}  `)).toEqual(input);
      expect(versionLikeSubstring(`${input}$`)).toEqual(input);
    });
    expect(versionLikeSubstring('')).toBeNull();
    expect(versionLikeSubstring(undefined)).toBeNull();
    expect(versionLikeSubstring(null)).toBeNull();
    expect(versionLikeSubstring('foobar')).toBeNull();
    expect(versionLikeSubstring('latest')).toBeNull();
  });

  it('isDependencyString', () => {
    expect(isDependencyString('foo:bar:1.2.3')).toBeTrue();
    expect(isDependencyString('foo.foo:bar.bar:1.2.3')).toBeTrue();
    expect(isDependencyString('foo:bar:baz:qux')).toBeFalse();
    expect(isDependencyString('foo.bar:baz:1.2.3')).toBeTrue();
    expect(isDependencyString('foo.bar:baz:1.2.3:linux-cpu-x86_64')).toBeTrue();
    expect(isDependencyString('foo.bar:baz:1.2.+')).toBeTrue();
    expect(isDependencyString('foo:bar:baz:qux:quux')).toBeFalse();
    expect(isDependencyString("foo:bar:1.2.3'")).toBeFalse();
    expect(isDependencyString('foo:bar:1.2.3"')).toBeFalse();
    expect(isDependencyString('-Xep:ParameterName:OFF')).toBeFalse();
    expect(isDependencyString('foo$bar:baz:1.2.+')).toBeFalse();
    expect(isDependencyString('scm:git:https://some.git')).toBeFalse();
  });

  it('parseDependencyString', () => {
    expect(parseDependencyString('foo:bar:1.2.3')).toMatchObject({
      depName: 'foo:bar',
      currentValue: '1.2.3',
    });
    expect(parseDependencyString('foo.foo:bar.bar:1.2.3')).toMatchObject({
      depName: 'foo.foo:bar.bar',
      currentValue: '1.2.3',
    });
    expect(parseDependencyString('foo.bar:baz:1.2.3')).toMatchObject({
      depName: 'foo.bar:baz',
      currentValue: '1.2.3',
    });
    expect(parseDependencyString('foo:bar:1.2.+')).toMatchObject({
      depName: 'foo:bar',
      currentValue: '1.2.+',
    });
    expect(parseDependencyString('foo:bar:baz:qux')).toBeNull();
    expect(parseDependencyString('foo:bar:baz:qux:quux')).toBeNull();
    expect(parseDependencyString("foo:bar:1.2.3'")).toBeNull();
    expect(parseDependencyString('foo:bar:1.2.3"')).toBeNull();
    expect(parseDependencyString('-Xep:ParameterName:OFF')).toBeNull();
  });

  it('reorderFiles', () => {
    expect(
      reorderFiles([
        'build.gradle',
        'a.gradle',
        'b.gradle',
        'a.gradle',
        'versions.gradle',
      ]),
    ).toStrictEqual([
      'versions.gradle',
      'a.gradle',
      'a.gradle',
      'b.gradle',
      'build.gradle',
    ]);

    expect(
      reorderFiles([
        'a/b/c/build.gradle',
        'a/b/versions.gradle',
        'a/build.gradle',
        'versions.gradle',
        'a/b/build.gradle',
        'a/versions.gradle',
        'build.gradle',
        'a/b/c/versions.gradle',
      ]),
    ).toStrictEqual([
      'versions.gradle',
      'build.gradle',
      'a/versions.gradle',
      'a/build.gradle',
      'a/b/versions.gradle',
      'a/b/build.gradle',
      'a/b/c/versions.gradle',
      'a/b/c/build.gradle',
    ]);

    expect(reorderFiles(['b.gradle', 'c.gradle', 'a.gradle'])).toStrictEqual([
      'a.gradle',
      'b.gradle',
      'c.gradle',
    ]);

    expect(
      reorderFiles(['b.gradle', 'c.gradle', 'a.gradle', 'gradle.properties']),
    ).toStrictEqual(['gradle.properties', 'a.gradle', 'b.gradle', 'c.gradle']);

    expect(
      reorderFiles([
        'a/b/c/gradle.properties',
        'a/b/c/build.gradle',
        'a/build.gradle',
        'a/gradle.properties',
        'a/b/build.gradle',
        'a/b/gradle.properties',
        'build.gradle',
        'gradle.properties',
        'b.gradle',
        'c.gradle',
        'a.gradle',
      ]),
    ).toStrictEqual([
      'gradle.properties',
      'a.gradle',
      'b.gradle',
      'c.gradle',
      'build.gradle',
      'a/gradle.properties',
      'a/build.gradle',
      'a/b/gradle.properties',
      'a/b/build.gradle',
      'a/b/c/gradle.properties',
      'a/b/c/build.gradle',
    ]);
  });

  it('getVars', () => {
    const registry: VariableRegistry = {
      [toAbsolutePath('/foo')]: {
        foo: { key: 'foo', value: 'FOO' },
        bar: { key: 'bar', value: 'BAR' },
        baz: { key: 'baz', value: 'BAZ' },
        qux: { key: 'qux', value: 'QUX' },
      },
      [toAbsolutePath('/foo/bar')]: {
        foo: { key: 'foo', value: 'foo' },
      },
      [toAbsolutePath('/foo/bar/baz')]: {
        bar: { key: 'bar', value: 'bar' },
        baz: { key: 'baz', value: 'baz' },
      },
    };
    const res = getVars(registry, '/foo/bar/baz/build.gradle');
    expect(res).toStrictEqual({
      foo: { key: 'foo', value: 'foo' },
      bar: { key: 'bar', value: 'bar' },
      baz: { key: 'baz', value: 'baz' },
      qux: { key: 'qux', value: 'QUX' },
    });
  });

  it('updateVars', () => {
    const registry: VariableRegistry = {
      [toAbsolutePath('/foo/bar/baz')]: {
        bar: { key: 'bar', value: 'bar' },
        baz: { key: 'baz', value: 'baz' },
      },
    };

    updateVars(registry, '/foo/bar/baz', { qux: { key: 'qux', value: 'qux' } });
    const res = getVars(registry, '/foo/bar/baz/build.gradle');
    expect(res).toStrictEqual({
      bar: { key: 'bar', value: 'bar' },
      baz: { key: 'baz', value: 'baz' },
      qux: { key: 'qux', value: 'qux' },
    });
  });
});
