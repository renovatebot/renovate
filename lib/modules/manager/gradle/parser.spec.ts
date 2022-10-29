import { Fixtures } from '../../../../test/fixtures';
import { fs, logger } from '../../../../test/util';
import { parseGradle, parseProps } from './parser';
import { GRADLE_PLUGINS, REGISTRY_URLS } from './parser/common';

jest.mock('../../../util/fs');

function mockFs(files: Record<string, string>): void {
  fs.getSiblingFileName.mockImplementation(
    (existingFileNameWithPath: string, otherFileName: string) => {
      return existingFileNameWithPath
        .slice(0, existingFileNameWithPath.lastIndexOf('/') + 1)
        .concat(otherFileName);
    }
  );
}

describe('modules/manager/gradle/parser', () => {
  it('handles end of input', () => {
    expect(parseGradle('version = ').deps).toBeEmpty();
    expect(parseGradle('id "foo.bar" version').deps).toBeEmpty();
  });

  describe('variables', () => {
    describe('Groovy: single var assignments', () => {
      test.each`
        input                                | name                 | value
        ${'foo = "1.2.3"'}                   | ${'foo'}             | ${'1.2.3'}
        ${'foo.bar = "1.2.3"'}               | ${'foo.bar'}         | ${'1.2.3'}
        ${'foo.bar.baz = "1.2.3"'}           | ${'foo.bar.baz'}     | ${'1.2.3'}
        ${'ext.foobar = "1.2.3"'}            | ${'foobar'}          | ${'1.2.3'}
        ${'foo["bar"] = "1.2.3"'}            | ${'foo.bar'}         | ${'1.2.3'}
        ${'foo["bar"]["baz"] = "1.2.3"'}     | ${'foo.bar.baz'}     | ${'1.2.3'}
        ${'foo["bar"]["baz.qux"] = "1.2.3"'} | ${'foo.bar.baz.qux'} | ${'1.2.3'}
        ${'foo.bar["baz"]["qux"] = "1.2.3"'} | ${'foo.bar.baz.qux'} | ${'1.2.3'}
        ${'ext["foo"] = "1.2.3"'}            | ${'foo'}             | ${'1.2.3'}
        ${'ext["foo"]["bar"] = "1.2.3"'}     | ${'foo.bar'}         | ${'1.2.3'}
        ${'extra["foo"] = "1.2.3"'}          | ${'foo'}             | ${'1.2.3'}
        ${'project.foobar = "1.2.3"'}        | ${'foobar'}          | ${'1.2.3'}
        ${'project.ext.foo.bar = "1.2.3"'}   | ${'foo.bar'}         | ${'1.2.3'}
        ${'rootProject.foobar = "1.2.3"'}    | ${'foobar'}          | ${'1.2.3'}
        ${'rootProject.foo.bar = "1.2.3"'}   | ${'foo.bar'}         | ${'1.2.3'}
      `('$input', ({ input, name, value }) => {
        const { vars } = parseGradle(input);
        expect(vars).toContainKey(name);
        expect(vars[name]).toMatchObject({ key: name, value });
      });
    });

    describe('Groovy: single var assignments (non-match)', () => {
      test.each`
        input
        ${'foo[["bar"]] = "baz"'}
        ${'foo["bar", "invalid"] = "1.2.3"'}
        ${'foo.bar["baz", "invalid"] = "1.2.3"'}
      `('$input', ({ input }) => {
        const { vars } = parseGradle(input);
        expect(vars).toBeEmpty();
      });
    });

    describe('Groovy: multi var assignments', () => {
      it('simple map', () => {
        const input = `
        ext {
          versions = [
            spotbugs_annotations  : '4.5.3',
            core                  : '1.7.0',
          ]

          ignored = [ 'asdf' ]

          libraries = [
            guava: "com.google.guava:guava:31.1-jre",
            detekt: '1.18.1',
          ]
        }
        `;

        const output = {
          'versions.spotbugs_annotations': '4.5.3',
          'versions.core': '1.7.0',
          'libraries.guava': 'com.google.guava:guava:31.1-jre',
          'libraries.detekt': '1.18.1',
        };

        const { vars } = parseGradle(input);
        for (const [key, value] of Object.entries(output)) {
          expect(vars).toContainKey(key);
          expect(vars[key]).toMatchObject({ key, value });
        }
      });

      it('nested map', () => {
        const input = `
          project.ext.versions = [
            some: invalidsymbol,
            android: [
              buildTools: '30.0.3'
            ],
            kotlin: '1.4.30',
            androidx: [
              paging: '2.1.2',
              kotlin: [
                stdlib: '1.4.20',
                coroutines: '1.3.7',
              ],
            ],
            espresso: '3.2.0'
          ]
        `;

        const output = {
          'versions.android.buildTools': '30.0.3',
          'versions.kotlin': '1.4.30',
          'versions.androidx.paging': '2.1.2',
          'versions.androidx.kotlin.stdlib': '1.4.20',
          'versions.androidx.kotlin.coroutines': '1.3.7',
          'versions.espresso': '3.2.0',
        };

        const { vars } = parseGradle(input);
        for (const [key, value] of Object.entries(output)) {
          expect(vars).toContainKey(key);
          expect(vars[key]).toMatchObject({ key, value });
        }
      });
    });

    describe('Kotlin: single var assignments', () => {
      test.each`
        input                        | name     | value
        ${'set("foo", "1.2.3")'}     | ${'foo'} | ${'1.2.3'}
        ${'version("foo", "1.2.3")'} | ${'foo'} | ${'1.2.3'}
      `('$input', ({ input, name, value }) => {
        const { vars } = parseGradle(input);
        expect(vars).toContainKey(name);
        expect(vars[name]).toMatchObject({ key: name, value });
      });
    });

    describe('Kotlin: single var assignments (non-match)', () => {
      test.each`
        input
        ${'set(["foo", "bar"])'}
        ${'set("foo", "bar", "baz", "qux"])'}
      `('$input', ({ input }) => {
        const { vars } = parseGradle(input);
        expect(vars).toBeEmpty();
      });
    });

    describe('Kotlin: single extra var assignments', () => {
      test.each`
        input                                              | name              | value
        ${'val slf4jVersion by extra("1.2.3")'}            | ${'slf4jVersion'} | ${'1.2.3'}
        ${'val comVersion by extra { "1.2.3" }'}           | ${'comVersion'}   | ${'1.2.3'}
        ${'val junitVersion: String by extra { "1.2.3" }'} | ${'junitVersion'} | ${'1.2.3'}
      `('$input', ({ input, name, value }) => {
        const { vars } = parseGradle(input);
        expect(vars).toContainKey(name);
        expect(vars[name]).toMatchObject({ key: name, value });
      });
    });

    describe('Kotlin: multi var assignments', () => {
      it('simple map', () => {
        const input =
          'val versions = mapOf("foo1" to "bar1", "foo2" to "bar2", "foo3" to "bar3")';
        const output = {
          'versions.foo1': 'bar1',
          'versions.foo2': 'bar2',
          'versions.foo3': 'bar3',
        };

        const { vars } = parseGradle(input);
        for (const [key, value] of Object.entries(output)) {
          expect(vars).toContainKey(key);
          expect(vars[key]).toMatchObject({ key, value });
        }
      });

      it('nested map', () => {
        const input = `
          ext["deps"] = mapOf(
            "support" to mapOf(
              "appCompat" to "com.android.support:appcompat-v7:26.0.2",
              "invalid" to whatever,
              "junit" to mapOf(
                "jupiter" to "5.0.1",
                "platform" to "1.0.1",
              )
              "design" to "com.android.support:design:26.0.2"
            ),
            "support2" to mapOfInvalid(
              "design2" to "com.android.support:design:26.0.2"
            ),
            "picasso" to "com.squareup.picasso:picasso:2.5.2"
          )
        `;

        const output = {
          'deps.support.appCompat': 'com.android.support:appcompat-v7:26.0.2',
          'deps.support.design': 'com.android.support:design:26.0.2',
          'deps.support.junit.jupiter': '5.0.1',
          'deps.support.junit.platform': '1.0.1',
          'deps.picasso': 'com.squareup.picasso:picasso:2.5.2',
        };

        const { vars } = parseGradle(input);
        for (const [key, value] of Object.entries(output)) {
          expect(vars).toContainKey(key);
          expect(vars[key]).toMatchObject({ key, value });
        }
      });
    });
  });

  describe('dependencies', () => {
    describe('simple dependency strings', () => {
      test.each`
        input                          | output
        ${'"foo:bar:1.2.3"'}           | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${'"foo:bar:1.2.3@zip"'}       | ${{ depName: 'foo:bar', currentValue: '1.2.3', dataType: 'zip' }}
        ${'foo.bar = "foo:bar:1.2.3"'} | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      `('$input', ({ input, output }) => {
        const { deps } = parseGradle(input);
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });

    describe('interpolated dependency strings', () => {
      test.each`
        def                                  | str                                    | output
        ${'foo = "1.2.3"'}                   | ${'"foo:bar:$foo@@@"'}                 | ${null}
        ${''}                                | ${'"foo:bar:$baz"'}                    | ${null}
        ${'foo = "1"; bar = "2"; baz = "3"'} | ${'"foo:bar:$foo.$bar.$baz"'}          | ${{ depName: 'foo:bar', currentValue: '1.2.3', skipReason: 'contains-variable' }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:$baz"'}                    | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'foo.bar = "1.2.3"'}               | ${'"foo:bar:$foo.bar"'}                | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'foo.bar' }}
        ${'foo = "1.2.3"'}                   | ${'"foo:bar_$foo:4.5.6"'}              | ${{ depName: 'foo:bar_1.2.3', managerData: { fileReplacePosition: 28 } }}
        ${'baz = "1.2.3"'}                   | ${'foobar = "foo:bar:$baz"'}           | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'foo = "${bar}"; baz = "1.2.3"'}   | ${'"foo:bar:${baz}"'}                  | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:${ext[\'baz\']}"'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:${ext.baz}"'}              | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:${project.ext[\'baz\']}"'} | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'a = "foo"; b = "bar"; c="1.2.3"'} | ${'"${a}:${b}:${property("c")}"'}      | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'c' }}
      `('$def | $str', ({ def, str, output }) => {
        const { deps } = parseGradle([def, str].join('\n'));
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });

    describe('property accessors', () => {
      test.each`
        accessor
        ${'property'}
        ${'getProperty'}
        ${'ext.getProperty'}
        ${'extra.get'}
        ${'project.property'}
        ${'project.getProperty'}
        ${'project.ext.getProperty'}
        ${'project.ext.get'}
        ${'project.extra.get'}
        ${'rootProject.property'}
        ${'rootProject.getProperty'}
        ${'rootProject.ext.getProperty'}
        ${'rootProject.extra.get'}
      `('$accessor', ({ accessor }) => {
        const input = `
          baz = "1.2.3"
          api("foo:bar:$\{${String(accessor)}("baz")}")
        `;
        const { deps } = parseGradle(input);
        expect(deps).toMatchObject([
          { depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' },
        ]);
      });
    });

    describe('dependencySet dependencies', () => {
      it('simple dependencySet', () => {
        const input = `
          ext.activemq_version = "5.8.0"
          dependencySet(group: 'org.apache.activemq', version: activemq_version) {
            entry 'activemq-broker'
            entry('activemq-kahadb-store') {
              exclude group: "org.springframework", name: "spring-context"
            }
            entry 'activemq-stomp'
          }
        `;

        const { deps } = parseGradle(input);
        expect(deps).toMatchObject([
          {
            depName: 'org.apache.activemq:activemq-broker',
            currentValue: '5.8.0',
            groupName: 'activemq_version',
          },
          {
            depName: 'org.apache.activemq:activemq-kahadb-store',
            currentValue: '5.8.0',
            groupName: 'activemq_version',
          },
          {
            depName: 'org.apache.activemq:activemq-stomp',
            currentValue: '5.8.0',
            groupName: 'activemq_version',
          },
        ]);
      });

      describe('dependencySet variants', () => {
        const validOutput = [
          {
            depName: 'foo:bar1',
            currentValue: '1.2.3',
            groupName: 'foo:1.2.3',
          },
          {
            depName: 'foo:bar2',
            currentValue: '1.2.3',
            groupName: 'foo:1.2.3',
          },
        ];
        const validOutput1 = validOutput.map((dep) => {
          return { ...dep, groupName: 'baz' };
        });

        test.each`
          def                               | str                                                                                                 | output
          ${''}                             | ${'dependencySet([group: "foo", version: "1.2.3"]) { entry "bar1" }'}                               | ${{}}
          ${''}                             | ${'dependencySet(group: "foo", version: "1.2.3", group: "foo", version: "1.2.3") { entry "bar1" }'} | ${{}}
          ${''}                             | ${'dependencySet(group: "foo", version: "1.2.3") { { entry "bar1" } }'}                             | ${{}}
          ${''}                             | ${'dependencySet(group: "foo", version: "1.2.3") { entry(["bar1"]) }'}                              | ${{}}
          ${''}                             | ${'dependencySet(group: "foo", version: "1.2.3") { entry("bar", "baz") }'}                          | ${{}}
          ${''}                             | ${'dependencySet(group: "${nonexistingvar}", version: "1.2.3") { entry "bar1"; entry "bar2" }'}     | ${{}}
          ${''}                             | ${'dependencySet(group: "foo", version: "1.2.3") { entry "bar1"; entry "bar2" }'}                   | ${validOutput}
          ${''}                             | ${'dependencySet(group: "foo", version: "1.2.3") { entry "bar1"; entry ("bar2") }'}                 | ${validOutput}
          ${'baz = "1.2.3"'}                | ${'dependencySet(group: "foo", version: baz) { entry "bar1"; entry ("bar2") }'}                     | ${validOutput1}
          ${'baz = "1.2.3"'}                | ${'dependencySet(group: "foo", version: "${baz}") { entry "bar1"; entry ("bar2") }'}                | ${validOutput1}
          ${'some = "foo"; other = "bar1"'} | ${'dependencySet(group: some, version: "1.2.3") { entry other; entry "bar2" }'}                     | ${validOutput}
          ${'some = "foo"; baz = "1.2.3"'}  | ${'dependencySet(group: some, version: "${baz}456") { entry "bar1"; entry "bar2" }'}                | ${{}}
          ${'some = "foo"; other = "bar1"'} | ${'dependencySet(group: some, version: "1.2.3") { entry(other); entry "bar2" }'}                    | ${validOutput}
          ${'some = "foo"; other = "bar1"'} | ${'dependencySet(group: "${some}", version: "1.2.3") { entry "${other}"; entry "bar2" }'}           | ${validOutput}
          ${'some = "foo"; other = "bar1"'} | ${'dependencySet(group: "${some}", version: "1.2.3") { entry("${other}"); entry "bar2" }'}          | ${validOutput}
          ${''}                             | ${'dependencySet(group = "foo", version = "1.2.3") { entry "bar1"; entry "bar2" }'}                 | ${validOutput}
        `('$def | $str', ({ def, str, output }) => {
          const { deps } = parseGradle([def, str].join('\n'));
          expect(deps).toMatchObject(output);
        });
      });
    });

    describe('map notation dependencies', () => {
      test.each`
        def                | str                                                                               | output
        ${''}              | ${'group: "foo", name: "bar", version: "1.2.3"'}                                  | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${'group: "foo", name: "bar", version: baz'}                                      | ${null}
        ${''}              | ${'group: "foo", name: "bar", version: "1.2.3@@@"'}                               | ${null}
        ${'baz = "1.2.3"'} | ${'group: "foo", name: "bar", version: baz'}                                      | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'some = "foo"'}  | ${'group: some, name: some, version: "1.2.3"'}                                    | ${{ depName: 'foo:foo', currentValue: '1.2.3' }}
        ${'some = "foo"'}  | ${'group: "${some}", name: "${some}", version: "1.2.3"'}                          | ${{ depName: 'foo:foo', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'} | ${'group: "foo", name: "bar", version: "${baz}"'}                                 | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'baz = "1.2.3"'} | ${'group: "foo", name: "bar", version: "${baz}456"'}                              | ${{ depName: 'foo:bar', skipReason: 'unknown-version' }}
        ${''}              | ${'(group: "foo", name: "bar", version: "1.2.3", classifier: "sources")'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${'(group: "foo", name: "bar", version: "1.2.3") {exclude module: "spring-jcl"}'} | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${"implementation platform(group: 'foo', name: 'bar', version: '1.2.3')"}         | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${'(group = "foo", name = "bar", version = "1.2.3")'}                             | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'} | ${'(group = "foo", name = "bar", version = baz)'}                                 | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'some = "foo"'}  | ${'(group = some, name = some, version = "1.2.3")'}                               | ${{ depName: 'foo:foo', currentValue: '1.2.3' }}
        ${'some = "foo"'}  | ${'(group = "${some}", name = "${some}", version = "1.2.3")'}                     | ${{ depName: 'foo:foo', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'} | ${'(group = "foo", name = "bar", version = "${baz}")'}                            | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'baz = "1.2.3"'} | ${'(group = "foo", name = "bar", version = "${baz}456")'}                         | ${{ depName: 'foo:bar', skipReason: 'unknown-version' }}
        ${''}              | ${'(group = "foo", name = "bar", version = "1.2.3", changing: true)'}             | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      `('$def | $str', ({ def, str, output }) => {
        const { deps } = parseGradle([def, str].join('\n'));
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });

    describe('plugins', () => {
      test.each`
        def                 | input                                      | output
        ${''}               | ${'id "foo.bar" version "1.2.3"'}          | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id(["foo.bar"]) version "1.2.3"'}       | ${null}
        ${''}               | ${'id("foo", "bar") version "1.2.3"'}      | ${null}
        ${''}               | ${'id("foo.bar") version "1.2.3"'}         | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id "foo.bar" version "$baz"'}           | ${{ depName: 'foo.bar', skipReason: 'unknown-version', currentValue: 'baz' }}
        ${'baz = "1.2.3"'}  | ${'id "foo.bar" version "$baz"'}           | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'}  | ${'id("foo.bar") version "$baz"'}          | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id "foo.bar" version "x${ab}cd"'}       | ${{ depName: 'foo.bar', skipReason: 'unknown-version' }}
        ${''}               | ${'id("foo.bar") version "$baz"'}          | ${{ depName: 'foo.bar', skipReason: 'unknown-version', currentValue: 'baz' }}
        ${''}               | ${'id("foo.bar") version "x${ab}cd"'}      | ${{ depName: 'foo.bar', skipReason: 'unknown-version' }}
        ${''}               | ${'id("foo.bar") version property("qux")'} | ${{ depName: 'foo.bar', skipReason: 'unknown-version' }}
        ${'baz = "1.2.3"'}  | ${'id("foo.bar") version property("baz")'} | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id "foo.bar" version baz'}              | ${{ depName: 'foo.bar', currentValue: 'baz', skipReason: 'unknown-version' }}
        ${'baz = "1.2.3"'}  | ${'id "foo.bar" version baz'}              | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'}  | ${'id("foo.bar") version baz'}             | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'kotlin("jvm") version "1.3.71"'}        | ${{ depName: 'org.jetbrains.kotlin.jvm', packageName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.3.71' }}
        ${'baz = "1.3.71"'} | ${'kotlin("jvm") version baz'}             | ${{ depName: 'org.jetbrains.kotlin.jvm', packageName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.3.71' }}
      `('$def | $input', ({ def, input, output }) => {
        const { deps } = parseGradle([def, input].join('\n'));
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });
  });

  describe('registries', () => {
    describe('predefined registries', () => {
      test.each`
        input                                          | output
        ${'mavenCentral()'}                            | ${REGISTRY_URLS.mavenCentral}
        ${'google()'}                                  | ${REGISTRY_URLS.google}
        ${'google { content { includeGroup "foo" } }'} | ${REGISTRY_URLS.google}
        ${'gradlePluginPortal()'}                      | ${REGISTRY_URLS.gradlePluginPortal}
        ${'jcenter()'}                                 | ${REGISTRY_URLS.jcenter}
      `('$input', ({ input, output }) => {
        const { urls } = parseGradle(`{ ${String(input)} }`);
        expect(urls).toStrictEqual([output].filter(Boolean));
      });
    });

    describe('custom registries', () => {
      test.each`
        def                         | input                                                             | url
        ${''}                       | ${'maven("")'}                                                    | ${null}
        ${''}                       | ${'maven(["https://foo.bar/baz/qux"])'}                           | ${null}
        ${''}                       | ${'maven("foo", "bar")'}                                          | ${null}
        ${''}                       | ${'maven("https://foo.bar/baz")'}                                 | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven("${base}/baz")'}                                         | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven(base)'}                                                  | ${'https://foo.bar'}
        ${''}                       | ${'maven(url = "https://foo.bar/baz")'}                           | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven(url = uri("https://foo.bar/baz"))'}                      | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven(uri("https://foo.bar/baz"))'}                            | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven(uri("${base}/baz"))'}                                    | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven(uri(base))'}                                             | ${'https://foo.bar'}
        ${''}                       | ${'maven(uri(["https://foo.bar/baz"]))'}                          | ${null}
        ${''}                       | ${'maven { ["https://foo.bar/baz"] }'}                            | ${null}
        ${''}                       | ${'maven { url "https://foo.bar/baz" }'}                          | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url "${base}/baz" }'}                                  | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven { url uri("https://foo.bar/baz") }'}                     | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url uri("${base}/baz") }'}                             | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven { url = "https://foo.bar/baz" }'}                        | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url = "${base}/baz" }'}                                | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url = base }'}                                         | ${'https://foo.bar'}
        ${''}                       | ${'maven { url = uri("https://foo.bar/baz") }'}                   | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url = uri("${base}/baz") }'}                           | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url = uri(base) }'}                                    | ${'https://foo.bar'}
        ${''}                       | ${'maven { uri(["https://foo.bar/baz"]) }'}                       | ${null}
        ${'base="https://foo.bar"'} | ${'maven { name "baz"\nurl = "${base}/${name}" }'}                | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { name = "baz"\nurl = "${base}/${name}" }'}              | ${'https://foo.bar/baz'}
        ${'some="baz"'}             | ${'maven { name = "${some}"\nurl = "https://foo.bar/${name}" }'}  | ${'https://foo.bar/baz'}
        ${'some="baz"'}             | ${'maven { name = some\nurl = "https://foo.bar/${name}" }'}       | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven { setUrl("https://foo.bar/baz") }'}                      | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { setUrl("${base}/baz") }'}                              | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { setUrl(base) }'}                                       | ${'https://foo.bar'}
        ${''}                       | ${'maven { setUrl(["https://foo.bar/baz"]) }'}                    | ${null}
        ${''}                       | ${'maven { setUrl("foo", "bar") }'}                               | ${null}
        ${''}                       | ${'publishing { repositories { maven("https://foo.bar/baz") } }'} | ${null}
      `('$def | $input', ({ def, input, url }) => {
        const expected = [url].filter(Boolean);
        const { urls } = parseGradle([def, `{ ${String(input)} }`].join('\n'));
        expect(urls).toStrictEqual(expected);
      });
    });
  });

  describe('version catalog', () => {
    test.each`
      def                                           | str                                                             | output
      ${'version("baz", "1.2.3")'}                  | ${'library("foo.bar", "foo", "bar").versionRef("baz")'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
      ${'version("baz", "1.2.3")'}                  | ${'library("foo.bar", "foo", "bar").versionRef("baz")'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
      ${''}                                         | ${'library("foo.bar", "foo", "bar").version("1.2.3")'}          | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${''}                                         | ${'library(["foo.bar", "foo", "bar"]).version("1.2.3")'}        | ${null}
      ${''}                                         | ${'library("foo", "bar", "baz", "qux").version("1.2.3")'}       | ${null}
      ${''}                                         | ${'library("foo.bar", "foo", "bar").version("1.2.3", "4.5.6")'} | ${null}
      ${''}                                         | ${'library("foo", bar, "baz").version("1.2.3")'}                | ${null}
      ${'group = "foo"; artifact="bar"'}            | ${'library("foo.bar", group, artifact).version("1.2.3")'}       | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'}                            | ${'library("foo.bar", "foo", "bar").version(baz)'}              | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'library("foo-bar_baz-qux", "foo", "bar")'} | ${'"${foo.bar.baz.qux}:1.2.3"'}                                 | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${''}                                         | ${'alias("foo.bar").to("foo", "bar").version("1.2.3")'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'version("baz", "1.2.3")'}                  | ${'alias("foo.bar").to("foo", "bar").versionRef("baz")'}        | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${''}                                         | ${'alias(["foo.bar"]).to("foo", "bar").version("1.2.3")'}       | ${null}
    `('$def | $str', ({ def, str, output }) => {
      const input = [def, str].join('\n');
      const { deps } = parseGradle(input);
      expect(deps).toMatchObject([output].filter(Boolean));
    });
  });

  describe('heuristic dependency matching', () => {
    test.each`
      input                                                        | output
      ${'("foo", "bar", "1.2.3")'}                                 | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'("foo", "bar", "1.2.3", "4.5.6")'}                        | ${null}
      ${'(["foo", "bar", "1.2.3"])'}                               | ${null}
      ${'someMethod("foo", "bar", "1.2.3")'}                       | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'createXmlValueRemover("defaults", "integer", "integer")'} | ${{ depName: 'defaults:integer', currentValue: 'integer', skipReason: 'ignored' }}
      ${'events("passed", "skipped", "failed")'}                   | ${{ depName: 'passed:skipped', currentValue: 'failed', skipReason: 'ignored' }}
      ${'args("foo", "bar", "baz")'}                               | ${{ depName: 'foo:bar', currentValue: 'baz', skipReason: 'ignored' }}
      ${'arrayOf("foo", "bar", "baz")'}                            | ${{ depName: 'foo:bar', currentValue: 'baz', skipReason: 'ignored' }}
      ${'listOf("foo", "bar", "baz")'}                             | ${{ depName: 'foo:bar', currentValue: 'baz', skipReason: 'ignored' }}
      ${'mutableListOf("foo", "bar", "baz")'}                      | ${{ depName: 'foo:bar', currentValue: 'baz', skipReason: 'ignored' }}
      ${'setOf("foo", "bar", "baz")'}                              | ${{ depName: 'foo:bar', currentValue: 'baz', skipReason: 'ignored' }}
      ${'mutableSetOf("foo", "bar", "baz")'}                       | ${{ depName: 'foo:bar', currentValue: 'baz', skipReason: 'ignored' }}
      ${'stages("foo", "bar", "baz")'}                             | ${{ depName: 'foo:bar', currentValue: 'baz', skipReason: 'ignored' }}
      ${'mapScalar("foo", "bar", "baz")'}                          | ${{ depName: 'foo:bar', currentValue: 'baz', skipReason: 'ignored' }}
    `('$input', ({ input, output }) => {
      const { deps } = parseGradle(input);
      expect(deps).toMatchObject([output].filter(Boolean));
    });
  });

  describe('calculations', () => {
    it('calculates offset', () => {
      const content = "'foo:bar:1.2.3'";
      const { deps } = parseGradle(content);
      const [res] = deps;
      const idx = content
        // TODO #7154
        .slice(res.managerData!.fileReplacePosition)
        .indexOf('1.2.3');
      expect(idx).toBe(0);
    });

    it('parses fixture from "gradle" manager', () => {
      const content = Fixtures.get('build.gradle.example1');
      const { deps } = parseGradle(content, {}, 'build.gradle');
      const replacementIndices = deps.map(({ managerData, currentValue }) =>
        // TODO #7154
        content.slice(managerData!.fileReplacePosition).indexOf(currentValue!)
      );
      expect(replacementIndices.every((idx) => idx === 0)).toBeTrue();
      expect(deps).toMatchSnapshot();
    });
  });

  describe('gradle.properties', () => {
    test.each`
      input            | key          | value    | fileReplacePosition
      ${'foo=bar'}     | ${'foo'}     | ${'bar'} | ${4}
      ${' foo = bar '} | ${'foo'}     | ${'bar'} | ${7}
      ${'foo.bar=baz'} | ${'foo.bar'} | ${'baz'} | ${8}
      ${'foo.bar:baz'} | ${'foo.bar'} | ${'baz'} | ${8}
      ${'foo.bar baz'} | ${'foo.bar'} | ${'baz'} | ${8}
    `('$input', ({ input, key, value, fileReplacePosition }) => {
      expect(parseProps(input)).toMatchObject({
        vars: { [key]: { key, value, fileReplacePosition } },
      });
    });

    it('handles multi-line file', () => {
      expect(parseProps('foo=foo\nbar=bar')).toMatchObject({
        vars: {
          foo: { key: 'foo', value: 'foo', fileReplacePosition: 4 },
          bar: { key: 'bar', value: 'bar', fileReplacePosition: 12 },
        },
        deps: [],
      });
    });

    it('attaches packageFile', () => {
      expect(
        parseProps('foo = bar', 'foo/bar/gradle.properties')
      ).toMatchObject({
        vars: { foo: { packageFile: 'foo/bar/gradle.properties' } },
      });
    });

    it('parses dependencies', () => {
      const res = parseProps('dep = foo:bar:1.2.3');

      expect(res).toMatchObject({
        deps: [
          {
            currentValue: '1.2.3',
            depName: 'foo:bar',
            managerData: { fileReplacePosition: 14 },
          },
        ],
      });
    });
  });

  describe('apply from', () => {
    const key = 'version';
    const value = '1.2.3';
    const validOutput = {
      version: {
        key,
        value,
        fileReplacePosition: 11,
        packageFile: 'foo/bar.gradle',
      },
    };

    const fileContents = {
      'foo/bar.gradle': key + ' = "' + value + '"',
    };
    mockFs(fileContents);

    test.each`
      def                        | input                                                     | output
      ${''}                      | ${'apply from: ""'}                                       | ${{}}
      ${''}                      | ${'apply from: "foo/invalid.gradle"'}                     | ${{}}
      ${''}                      | ${'apply from: "${base}"'}                                | ${{}}
      ${''}                      | ${'apply from: "foo/invalid.non-gradle"'}                 | ${{}}
      ${''}                      | ${'apply from: "https://someurl.com/file.gradle"'}        | ${{}}
      ${''}                      | ${'apply from: "foo/bar.gradle"'}                         | ${validOutput}
      ${'base="foo"'}            | ${'apply from: "${base}/bar.gradle"'}                     | ${validOutput}
      ${'path="foo/bar.gradle"'} | ${'apply from: property("path")'}                         | ${validOutput}
      ${''}                      | ${'apply from: file("foo/bar.gradle")'}                   | ${validOutput}
      ${'base="foo"'}            | ${'apply from: file("${base}/bar.gradle")'}               | ${validOutput}
      ${''}                      | ${'apply from: project.file("foo/bar.gradle")'}           | ${validOutput}
      ${''}                      | ${'apply from: rootProject.file("foo/bar.gradle")'}       | ${validOutput}
      ${''}                      | ${'apply from: new File("foo/bar.gradle")'}               | ${validOutput}
      ${'base="foo"'}            | ${'apply from: new File("${base}/bar.gradle")'}           | ${validOutput}
      ${''}                      | ${'apply from: new File("foo", "bar.gradle")'}            | ${validOutput}
      ${'base="foo"'}            | ${'apply from: new File(base, "bar.gradle")'}             | ${validOutput}
      ${'base="foo"'}            | ${'apply from: new File("${base}", "bar.gradle")'}        | ${validOutput}
      ${'path="bar.gradle"'}     | ${'apply from: new File("foo", "${path}")'}               | ${validOutput}
      ${'path="bar.gradle"'}     | ${'apply from: new File("foo", property("path"))'}        | ${validOutput}
      ${'base="foo"'}            | ${'apply from: new File(property("base"), "bar.gradle")'} | ${validOutput}
      ${''}                      | ${'apply(from = "foo/bar.gradle"))'}                      | ${validOutput}
      ${'base="foo"'}            | ${'apply(from = "${base}/bar.gradle"))'}                  | ${validOutput}
      ${''}                      | ${'apply(from = File("foo/bar.gradle"))'}                 | ${validOutput}
      ${''}                      | ${'apply(from = File("foo", "bar", "baz"))'}              | ${{}}
      ${''}                      | ${'apply(from = File(["${somedir}/foo.gradle"]))'}        | ${{}}
      ${'base="foo"'}            | ${'apply(from = File("${base}/bar.gradle"))'}             | ${validOutput}
      ${''}                      | ${'apply(from = File("foo", "bar.gradle"))'}              | ${validOutput}
      ${'base="foo"'}            | ${'apply(from = File(base, "bar.gradle"))'}               | ${validOutput}
      ${'base="foo"'}            | ${'apply(from = File("${base}", "bar.gradle"))'}          | ${validOutput}
    `('$def | $input', ({ def, input, output }) => {
      const { vars } = parseGradle(
        [def, input].join('\n'),
        {},
        '',
        fileContents
      );
      expect(vars).toMatchObject(output);
    });

    it('recursion check', () => {
      const { vars } = parseGradle(
        'apply from: "foo/bar.gradle"',
        {},
        '',
        fileContents,
        3
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Max recursion depth reached in script file: foo/bar.gradle'
      );
      expect(vars).toBeEmpty();
    });
  });

  describe('implicit gradle plugins', () => {
    test.each`
      def                | input                                           | output
      ${'baz = "1.2.3"'} | ${'checkstyle { toolVersion = "${baz}" }'}      | ${{ depName: 'checkstyle', packageName: GRADLE_PLUGINS['checkstyle'], currentValue: '1.2.3', depType: 'devDependencies' }}
      ${''}              | ${'codenarc { toolVersion = "1.2.3" }'}         | ${{ depName: 'codenarc', packageName: GRADLE_PLUGINS['codenarc'], currentValue: '1.2.3' }}
      ${''}              | ${'detekt { toolVersion = "1.2.3" }'}           | ${{ depName: 'detekt', packageName: GRADLE_PLUGINS['detekt'], currentValue: '1.2.3' }}
      ${''}              | ${'findbugs { toolVersion = "1.2.3" }'}         | ${{ depName: 'findbugs', packageName: GRADLE_PLUGINS['findbugs'], currentValue: '1.2.3' }}
      ${''}              | ${'googleJavaFormat { toolVersion = "1.2.3" }'} | ${{ depName: 'googleJavaFormat', packageName: GRADLE_PLUGINS['googleJavaFormat'], currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'} | ${'jacoco { toolVersion = baz }'}               | ${{ depName: 'jacoco', packageName: GRADLE_PLUGINS['jacoco'], currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'} | ${'jacoco { toolVersion = property("baz") }'}   | ${{ depName: 'jacoco', packageName: GRADLE_PLUGINS['jacoco'], currentValue: '1.2.3' }}
      ${''}              | ${'lombok { version = "1.2.3" }'}               | ${{ depName: 'lombok', packageName: GRADLE_PLUGINS['lombok'], currentValue: '1.2.3' }}
      ${''}              | ${'pmd { toolVersion = "1.2.3" }'}              | ${{ depName: 'pmd', packageName: GRADLE_PLUGINS['pmd'], currentValue: '1.2.3' }}
      ${''}              | ${'spotbugs { toolVersion = "1.2.3" }'}         | ${{ depName: 'spotbugs', packageName: GRADLE_PLUGINS['spotbugs'], currentValue: '1.2.3' }}
      ${''}              | ${'pmd { toolVersion = "@@@" }'}                | ${null}
      ${''}              | ${'pmd { toolVersion = "${baz}" }'}             | ${null}
      ${'baz = "1.2.3"'} | ${'pmd { toolVersion = "${baz}.456" }'}         | ${{ depName: 'pmd', currentValue: '1.2.3.456', skipReason: 'unknown-version' }}
      ${''}              | ${'pmd { [toolVersion = "6.36.0"] }'}           | ${null}
      ${''}              | ${'unknown { toolVersion = "1.2.3" }'}          | ${null}
    `('$def | $input', ({ def, input, output }) => {
      const { deps } = parseGradle([def, input].join('\n'));
      expect(deps).toMatchObject([output].filter(Boolean));
    });
  });
});
