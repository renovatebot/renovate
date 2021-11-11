import { TestApi } from 'azure-devops-node-api/TestApi';
import { loadFixture } from '../../../../test/util';
import { SkipReason } from '../../../types';
import {
  GOOGLE_REPO,
  GRADLE_PLUGIN_PORTAL_REPO,
  JCENTER_REPO,
  MAVEN_REPO,
} from './common';
import { parseGradle, parseProps } from './parser';

describe('manager/gradle/shallow/parser', () => {
  it('handles end of input', () => {
    expect(parseGradle('version = ').deps).toBeEmpty();
    expect(parseGradle('id "foo.bar" version').deps).toBeEmpty();
  });
  it('handles unparseable strings', () => {
    expect(parseGradle('"foo:bar:version@@@"').deps).toBeEmpty();
  })

  describe('variables', () => {
    // TODO: nested variables
    test.each(['version = "1.2.3"', 'set("version", "1.2.3")'])(
      'detection when set like `%s`',
      (input) => {
        let { vars } = parseGradle(input);
        expect(vars.version.value).toEqual('1.2.3');
      }
    );
    test.each(['"foo:bar_$version:$version"'])(
      'using the proper variable altough it got reassigned %s',
      (input) => {
        let testString = `
          set("version", "1.2.3")
          ${input}
          set("version", "3.2.1")`;
        let { deps, vars } = parseGradle(testString);
        expect(deps).toMatchObject([
          {
            depName: 'foo:bar_1.2.3',
            currentValue: '1.2.3',
          },
        ]);
        expect(vars.version.value).toEqual('3.2.1');
      }
    );

    it('in long dep strings', () => {
      expect(
        parseGradle('foo.bar = "foo:bar:1.2.3"', {}, 'versions.gradle')
      ).toMatchObject({
        vars: {
          'foo.bar': {
            fileReplacePosition: 11,
            key: 'foo.bar',
            packageFile: 'versions.gradle',
            value: 'foo:bar:1.2.3',
          },
        },
        deps: [
          {
            depName: 'foo:bar',
            currentValue: '1.2.3',
            groupName: 'foo.bar',
            managerData: {
              fileReplacePosition: 19,
            },
          },
        ],
      });
    });
  });

  describe('dependencies', () => {
    test.each([
      ["'foo'", 'bar', "'version'"],
      ['foo', "'bar'", "'version'"],
      ["'foo'", "'bar'", 'version'],
    ])(
      'without proper variables we will not get a dependency - %s - %s - %s',
      (group, artifact, version) => {
        expect(
          parseGradle(`group: ${group}, name: ${artifact}, version: ${version}`)
            .deps
        ).toBeEmpty();
        expect(
          parseGradle(
            `implementation platform(group: ${group}, name: ${artifact}, version: ${version})`
          ).deps
        ).toBeEmpty();
        expect(
          parseGradle(
            `(group = ${group}, name = ${artifact}, version = ${version}`
          ).deps
        ).toBeEmpty();
        expect(
          parseGradle(`(${group}, ${artifact}, ${version}`).deps
        ).toBeEmpty();
      }
    );

    [
      'foo',
      '"foo"',
      "'foo'",
      '"$foo"',
      '"${foo}"',
      '"${f}${o}${o}"',
      '"$f$o$o"',
      '"$f${o}o"',
    ].forEach((group: String) => {
      [
        'bar',
        '"bar"',
        "'bar'",
        '"$bar"',
        '"${bar}"',
        '"${b}${a}${r}"',
        '"$b$a$r"',
        '"$b${a}r"',
      ].forEach((artifact: String) => {
        [
          'version',
          '"version"',
          "'version'",
          '"$version"',
          '"${version}"',
          //'"${ver}${sion}"',
          '"${ver}sion"',
        ].forEach((version: String) => {
          describe(`with group: ${group}, artifact: ${artifact}, version: ${version}`, () => {
            
            test.each([
              `"${group.replace(/['"]+/g, '')}:${artifact.replace(/['"]+/g,'')}:${version.replace(/['"]+/g, '')}"`,
              `"${group.replace(/['"]+/g, '')}:${artifact.replace(/['"]+/g,'')}:${version.replace(/['"]+/g, '')}@ext"`
            ])('%s', (input) => {
              let testString = `
                      set("foo", "foo")
                      set("f", "f")
                      set("o", "o")
                      set("bar", "bar")
                      set("b", "b")
                      set("a", "a")
                      set("r", "r")
                      set("version", "version")
                      set("ver", "ver")
                      set("sion", "sion")
                      ${input}`;

              expect(parseGradle(testString).deps).toMatchObject([
                {
                  depName: 'foo:bar',
                  currentValue: 'version',
                },
              ]);
            });

            test.each([
              `group: ${group}, name: ${artifact}, version: ${version}`,
              `implementation platform(group: ${group}, name: ${artifact}, version: ${version})`,
              `(${group}, ${artifact}, ${version})`,
              `(group = ${group}, name = ${artifact}, version = ${version})`,
            ])('%s', (input) => {
              let testString = `
                set("foo", "foo")
                set("f", "f")
                set("o", "o")
                set("bar", "bar")
                set("b", "b")
                set("a", "a")
                set("r", "r")
                set("version", "version")
                set("ver", "ver")
                set("sion", "sion")
                ${input}`;

              expect(parseGradle(testString).deps).toMatchObject([
                {
                  depName: 'foo:bar',
                  currentValue: 'version',
                },
              ]);
            });

            it('createXmlValueRemover(...)', () => {
              let testString = `
                      set("foo", "foo")
                      set("f", "f")
                      set("o", "o")
                      set("bar", "bar")
                      set("b", "b")
                      set("a", "a")
                      set("r", "r")
                      set("version", "version")
                      set("ver", "ver")
                      set("sion", "sion")
                      createXmlValueRemover(${group}, ${artifact}, ${version})"`;

              expect(parseGradle(testString).deps).toMatchObject([
                {
                  depName: 'foo:bar',
                  currentValue: 'version',
                  skipReason: SkipReason.Ignored,
                },
              ]);
            });
          });
        });
      });
    });
  });

  describe('plugins', () => {
    [
      '"foo"',
      "'foo'",
    ].forEach((id: String) => {
        [
          '"version"',
          "'version'",
          '"$version"',
          '"${version}"',
          '"${ver}${sion}"',
          '"${ver}sion"',
          '"ver${sion}"',
        ].forEach((version: String) => {
          [
            '',
            'apply true',
            'apply false',
          ].forEach((apply: String) => {
            test.each([
              `id ${id} version ${version} ${apply}`,
              `id(${id}) version ${version} ${apply}`,
            ])("checking `%s`", (input) => {
              let testString = `
                set("version", "version")
                set("ver", "ver")
                set("sion", "sion")
                ${input}`;
                expect(parseGradle(testString).deps).toMatchObject([
                  {
                    depName: 'foo',
                    lookupName: 'foo:foo.gradle.plugin',
                    currentValue: 'version',
                  },
                ])
            })

            test.each([
              `kotlin(${id}) version ${version} ${apply}`,
            ])("checking `%s`", (input) => {
              let testString = `
                set("version", "version")
                set("ver", "ver")
                set("sion", "sion")
                ${input}`;
                expect(parseGradle(testString).deps).toMatchObject([
                  {
                    depName: 'org.jetbrains.kotlin.foo',
                    lookupName:
                      'org.jetbrains.kotlin.foo:org.jetbrains.kotlin.foo.gradle.plugin',
                    currentValue: 'version',
                  },
                ])
            })
          })
        })
      })
  });
  describe('urls', () => {
    test.each([
      'url "https://example.com"',
      'url "$var"',
      'url "${var}"',
      'url var',
      'url "https://example${com}"',
      'url("https://example.com")',
      'url("$var")',
      'url("${var}")',
      'url(var)',
      'url("https://example${com}")',
      'uri "https://example.com"',
      'maven { url = uri("https://example.com") }',
      "maven { url 'https://example.com' }",
      'maven "https://example.com"',
      'maven "$var"',
      'maven "${var}"',
      'maven var',
      'maven "https://example${com}"',
      'maven("https://example.com")',
      'maven("$var")',
      'maven("${var}")',
      'maven(var)',
      'maven("https://example${com}")',
    ])('parsing for `%s`', (input) => {
      let testString = `
          set("var", "https://example.com")
          set("com", ".com")
          ${input}
          `;
      expect(parseGradle(testString).urls).toStrictEqual(['https://example.com']);
    });
 
    test.each([
        'url ""',
        'url "#!@"',
        'url \'$var\'',
        'url \'${var}\'',
        'url "sadfasdfasdfasdf"',
        'url("")',
        'uri ""',
        'maven("")',
        'maven { url = uri("") }',
        "maven { url '' }",
      ])('parsing for non-valid `%s`', (input) => {
      let testString = `
          set("var", "https://example.com")
          set("com", ".com")
          ${input}
          `;
      expect(parseGradle(testString).urls).toBeEmpty();
    });

    test.each([
      'mavenCentral(); uri("https://example.com"); jcenter(); google(); gradlePluginPortal();',
      'mavenCentral();\nuri("https://example.com");\njcenter();\ngoogle();\ngradlePluginPortal();',
    ])('registry order $#', (input) => {
      let urls;
      ({ urls } = parseGradle(input));
      expect(urls).toStrictEqual([
        MAVEN_REPO,
        'https://example.com',
        JCENTER_REPO,
        GOOGLE_REPO,
        GRADLE_PLUGIN_PORTAL_REPO,
      ]);
    });
  });

  describe('properties', () => {
    test.each([
      {
        input: ['foo=bar'],
        output: {
          deps: [],
          vars: {
            foo: {
              fileReplacePosition: 4,
              key: 'foo',
              value: 'bar',
              packageFile: undefined,
            },
          },
        },
      },
      {
        input: [' foo = bar '],
        output: {
          deps: [],
          vars: {
            foo: {
              key: 'foo',
              value: 'bar',
              fileReplacePosition: 7,
              packageFile: undefined,
            },
          },
        },
      },
      {
        input: ['foo.bar=baz'],
        output: {
          deps: [],
          vars: {
            'foo.bar': {
              key: 'foo.bar',
              value: 'baz',
              fileReplacePosition: 8,
              packageFile: undefined,
            },
          },
        },
      },
      {
        input: ['foo=foo\nbar=bar'],
        output: {
          deps: [],
          vars: {
            foo: {
              key: 'foo',
              value: 'foo',
              fileReplacePosition: 4,
              packageFile: undefined,
            },
            bar: {
              key: 'bar',
              value: 'bar',
              fileReplacePosition: 12,
              packageFile: undefined,
            },
          },
        },
      },
      {
        input: ['x=foo', 'x/gradle.properties'],
        output: {
          deps: [],
          vars: {
            x: {
              fileReplacePosition: 2,
              key: 'x',
              packageFile: 'x/gradle.properties',
            },
          },
        },
      },
      {
        input: ['x=foo:bar:baz', 'x/gradle.properties'],
        output: {
          vars: {},
          deps: [
            {
              currentValue: 'baz',
              depName: 'foo:bar',
              managerData: {
                fileReplacePosition: 10,
                packageFile: 'x/gradle.properties',
              },
            },
          ],
        },
      },
    ])('testing for $input', ({ input, output }) => {
      expect(parseProps(...(input as [string, string]))).toMatchObject(output);
    });
  });

  it('parses fixture from "gradle" manager', () => {
    const content = loadFixture('build.gradle.example1', '../deep/');
    const { deps } = parseGradle(content, {}, 'build.gradle');
    deps.forEach((dep) => {
      expect(
        content
          .slice(dep.managerData.fileReplacePosition)
          .indexOf(dep.currentValue)
      ).toBe(0);
    });
    expect(deps).toMatchSnapshot();
  });
  it('calculates offset', () => {
    const content = "'foo:bar:1.2.3'";
    const { deps } = parseGradle(content);
    const res = deps[0];
    expect(
      content.slice(res.managerData.fileReplacePosition).indexOf('1.2.3')
    ).toBe(0);
  });
});
