import type { PackageVariables, VariableRegistry } from './types';
import {
  getVars,
  isDependencyString,
  isGradleBuildFile,
  isGradleScriptFile,
  isGradleVersionsFile,
  isKotlinSourceFile,
  isPropsFile,
  isTOMLFile,
  parseDependencyString,
  reorderFiles,
  toAbsolutePath,
  updateVars,
  versionLikeSubstring,
} from './utils';

describe('modules/manager/gradle/utils', () => {
  describe('versionLikeSubstring', () => {
    it('extracts the actual version', () => {
      const inputs = [
        '1.2.3',
        '[1.0,2.0]',
        '(,2.0[',
        '2.1.1.RELEASE',
        '1.0.+',
        '2022-05-10_55',
      ];
      const suffixes = ['', "'", '"', '\n', '  ', '$'];

      for (const input of inputs) {
        for (const suffix of suffixes) {
          expect(versionLikeSubstring(`${input}${suffix}`)).toEqual(input);
        }
      }
    });

    it('returns null for invalid inputs', () => {
      const inputs = [
        '',
        undefined,
        null,
        'foobar',
        'latest',
        '[1.6.0, ]  ,  abc',
      ];
      for (const input of inputs) {
        expect(versionLikeSubstring(input)).toBeNull();
      }
    });
  });

  describe('isDependencyString', () => {
    it.each`
      input                                    | output
      ${'foo:bar:1.2.3'}                       | ${true}
      ${'foo.foo:bar.bar:1.2.3'}               | ${true}
      ${'foo.bar:baz:1.2.3'}                   | ${true}
      ${'foo.bar:baz:1.2.3:linux-cpu-x86_64'}  | ${true}
      ${'foo:bar:1.2.3@zip'}                   | ${true}
      ${'foo:bar:x86@x86'}                     | ${true}
      ${'foo.bar:baz:1.2.+'}                   | ${true}
      ${'foo.bar:baz:[1.6.0, ]'}               | ${true}
      ${'foo.bar:baz:[, 1.6.0)'}               | ${true}
      ${'foo.bar:baz:]1.6.0,]'}                | ${true}
      ${'foo:bar:baz:qux'}                     | ${false}
      ${'foo:bar:baz:qux:quux'}                | ${false}
      ${"foo:bar:1.2.3'"}                      | ${false}
      ${'foo:bar:1.2.3"'}                      | ${false}
      ${'-Xep:ParameterName:OFF'}              | ${false}
      ${'foo$bar:baz:1.2.+'}                   | ${false}
      ${'scm:git:https://some.git'}            | ${false}
      ${'foo.bar:baz:1.2.3:linux-cpu$-x86_64'} | ${false}
      ${'foo:bar:1.2.3@zip@foo'}               | ${false}
    `('$input', ({ input, output }) => {
      expect(isDependencyString(input)).toBe(output);
    });
  });

  describe('parseDependencyString', () => {
    it.each`
      input                       | output
      ${'foo:bar:1.2.3'}          | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'foo.foo:bar.bar:1.2.3'}  | ${{ depName: 'foo.foo:bar.bar', currentValue: '1.2.3' }}
      ${'foo.bar:baz:1.2.3'}      | ${{ depName: 'foo.bar:baz', currentValue: '1.2.3' }}
      ${'foo:bar:1.2.+'}          | ${{ depName: 'foo:bar', currentValue: '1.2.+' }}
      ${'foo.bar:baz:[1.6.0, ]'}  | ${{ depName: 'foo.bar:baz', currentValue: '[1.6.0, ]' }}
      ${'foo:bar:1.2.3@zip'}      | ${{ depName: 'foo:bar', currentValue: '1.2.3', dataType: 'zip' }}
      ${'foo:bar:baz:qux'}        | ${null}
      ${'foo:bar:baz:qux:quux'}   | ${null}
      ${"foo:bar:1.2.3'"}         | ${null}
      ${'foo:bar:1.2.3"'}         | ${null}
      ${'-Xep:ParameterName:OFF'} | ${null}
    `('$input', ({ input, output }) => {
      expect(parseDependencyString(input)).toEqual(output);
    });
  });

  it('filetype checks', () => {
    expect(isGradleScriptFile('/a/Somefile.gradle.kts')).toBeTrue();
    expect(isGradleScriptFile('/a/Somefile.gradle')).toBeTrue();
    expect(isGradleVersionsFile('/a/versions.gradle.kts')).toBeTrue();
    expect(isGradleBuildFile('/a/build.gradle')).toBeTrue();
    expect(isPropsFile('/a/gradle.properties')).toBeTrue();
    expect(isKotlinSourceFile('/a/Somefile.kt')).toBeTrue();
    expect(isTOMLFile('/a/Somefile.toml')).toBeTrue();
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

  describe('updateVars', () => {
    it('empty registry', () => {
      const registry: VariableRegistry = {};
      const newVars: PackageVariables = {
        qux: { key: 'qux', value: 'qux' },
      };
      updateVars(registry, '/foo/bar/baz', newVars);
      expect(registry).toStrictEqual({ '/foo/bar/baz': newVars });
    });

    it('updates the registry', () => {
      const registry: VariableRegistry = {
        [toAbsolutePath('/foo/bar/baz')]: {
          bar: { key: 'bar', value: 'bar' },
          baz: { key: 'baz', value: 'baz' },
        },
      };

      updateVars(registry, '/foo/bar/baz', {
        qux: { key: 'qux', value: 'qux' },
      });
      const res = getVars(registry, '/foo/bar/baz/build.gradle');
      expect(res).toStrictEqual({
        bar: { key: 'bar', value: 'bar' },
        baz: { key: 'baz', value: 'baz' },
        qux: { key: 'qux', value: 'qux' },
      });
    });
  });
});
