import is from '@sindresorhus/is';
import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { fs, logger } from '../../../../test/util';
import { parseGradle, parseKotlinSource, parseProps } from './parser';
import { GRADLE_PLUGINS, REGISTRY_URLS } from './parser/common';

jest.mock('../../../util/fs');

function mockFs(files: Record<string, string>): void {
  fs.getSiblingFileName.mockImplementation(
    (existingFileNameWithPath: string, otherFileName: string) => {
      return existingFileNameWithPath
        .slice(0, existingFileNameWithPath.lastIndexOf('/') + 1)
        .concat(otherFileName);
    },
  );
}

describe('modules/manager/gradle/parser', () => {
  it('handles end of input', () => {
    expect(parseGradle('version = ').deps).toBeEmpty();
    expect(parseGradle('id "foo.bar" version').deps).toBeEmpty();
  });

  describe('variables', () => {
    describe('Groovy: single var assignments', () => {
      it.each`
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
      it.each`
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
        const input = codeBlock`
        ext {
          versions = [
            spotbugs_annotations  : '4.5.3',
            core                  : '1.7.0',
          ]

          ignored = [ 'asdf' ]

          libraries = [:]
          libraries += [
            guava: "com.google.guava:guava:31.1-jre",
            detekt: '1.18.1',
            core2: versions.core
          ]
        }
        `;

        const { vars } = parseGradle(input);
        expect(vars).toMatchObject({
          'versions.spotbugs_annotations': {
            key: 'versions.spotbugs_annotations',
            value: '4.5.3',
          },
          'versions.core': {
            key: 'versions.core',
            value: '1.7.0',
          },
          'libraries.guava': {
            key: 'libraries.guava',
            value: 'com.google.guava:guava:31.1-jre',
          },
          'libraries.detekt': {
            key: 'libraries.detekt',
            value: '1.18.1',
          },
          'libraries.core2': {
            key: 'versions.core',
            value: '1.7.0',
          },
        });
      });

      it('nested map', () => {
        const input = codeBlock`
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

        const { vars } = parseGradle(input);
        expect(vars).toMatchObject({
          'versions.android.buildTools': {
            key: 'versions.android.buildTools',
            value: '30.0.3',
          },
          'versions.kotlin': {
            key: 'versions.kotlin',
            value: '1.4.30',
          },
          'versions.androidx.paging': {
            key: 'versions.androidx.paging',
            value: '2.1.2',
          },
          'versions.androidx.kotlin.stdlib': {
            key: 'versions.androidx.kotlin.stdlib',
            value: '1.4.20',
          },
          'versions.androidx.kotlin.coroutines': {
            key: 'versions.androidx.kotlin.coroutines',
            value: '1.3.7',
          },
          'versions.espresso': {
            key: 'versions.espresso',
            value: '3.2.0',
          },
        });
      });

      it('map with interpolated dependency strings', () => {
        const input = codeBlock`
          def slfj4Version = "2.0.0"
          libraries = [
            jcl: "org.slf4j:jcl-over-slf4j:\${slfj4Version}",
            releaseCoroutines: "org.jetbrains.kotlinx:kotlinx-coroutines-core:0.26.1-eap13"
            api: "org.slf4j:slf4j-api:$slfj4Version",
          ]
          foo = [ group: "org.slf4j", name: "slf4j-ext", version: slfj4Version ]
        `;

        const { deps } = parseGradle(input);
        expect(deps).toMatchObject([
          {
            depName: 'org.slf4j:jcl-over-slf4j',
            groupName: 'slfj4Version',
            currentValue: '2.0.0',
          },
          {
            depName: 'org.jetbrains.kotlinx:kotlinx-coroutines-core',
            groupName: 'libraries.releaseCoroutines',
            currentValue: '0.26.1-eap13',
          },
          {
            depName: 'org.slf4j:slf4j-api',
            groupName: 'slfj4Version',
            currentValue: '2.0.0',
          },
          {
            depName: 'org.slf4j:slf4j-ext',
            groupName: 'slfj4Version',
            currentValue: '2.0.0',
          },
        ]);
      });
    });

    describe('Kotlin: single var assignments', () => {
      it.each`
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
      it.each`
        input
        ${'set(["foo", "bar"])'}
        ${'set("foo", "bar", "baz", "qux"])'}
      `('$input', ({ input }) => {
        const { vars } = parseGradle(input);
        expect(vars).toBeEmpty();
      });
    });

    describe('Kotlin: single extra var assignments', () => {
      it.each`
        input                                     | name     | value
        ${'val foo by extra("1.2.3")'}            | ${'foo'} | ${'1.2.3'}
        ${'val foo by extra { "1.2.3" }'}         | ${'foo'} | ${'1.2.3'}
        ${'val foo: String by extra { "1.2.3" }'} | ${'foo'} | ${'1.2.3'}
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

        const { vars } = parseGradle(input);
        expect(vars).toMatchObject({
          'versions.foo1': {
            key: 'versions.foo1',
            value: 'bar1',
          },
          'versions.foo2': {
            key: 'versions.foo2',
            value: 'bar2',
          },
          'versions.foo3': {
            key: 'versions.foo3',
            value: 'bar3',
          },
        });
      });

      it('nested map', () => {
        const input = codeBlock`
          val junitPlatformVersion: String by extra { "1.0.1" }
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
            "picasso" to "com.squareup.picasso:picasso:2.5.2",
            "junit-platform-runner" to junitPlatformVersion
          )
        `;

        const { vars } = parseGradle(input);
        expect(vars).toMatchObject({
          'deps.support.appCompat': {
            key: 'deps.support.appCompat',
            value: 'com.android.support:appcompat-v7:26.0.2',
          },
          'deps.support.junit.jupiter': {
            key: 'deps.support.junit.jupiter',
            value: '5.0.1',
          },
          'deps.support.junit.platform': {
            key: 'deps.support.junit.platform',
            value: '1.0.1',
          },
          'deps.support.design': {
            key: 'deps.support.design',
            value: 'com.android.support:design:26.0.2',
          },
          'deps.picasso': {
            key: 'deps.picasso',
            value: 'com.squareup.picasso:picasso:2.5.2',
          },
          'deps.junit-platform-runner': {
            key: 'junitPlatformVersion',
            value: '1.0.1',
          },
        });
      });

      it('map with interpolated dependency strings', () => {
        const input = codeBlock`
          val slfj4Version = "2.0.0"
          libraries = mapOf(
            "jcl" to "org.slf4j:jcl-over-slf4j:\${slfj4Version}",
            "releaseCoroutines" to "org.jetbrains.kotlinx:kotlinx-coroutines-core:0.26.1-eap13"
            "api" to "org.slf4j:slf4j-api:$slfj4Version",
          )
        `;

        const { deps } = parseGradle(input);
        expect(deps).toMatchObject([
          {
            depName: 'org.slf4j:jcl-over-slf4j',
            groupName: 'slfj4Version',
            currentValue: '2.0.0',
          },
          {
            depName: 'org.jetbrains.kotlinx:kotlinx-coroutines-core',
            groupName: 'libraries.releaseCoroutines',
            currentValue: '0.26.1-eap13',
          },
          {
            depName: 'org.slf4j:slf4j-api',
            groupName: 'slfj4Version',
            currentValue: '2.0.0',
          },
        ]);
      });
    });
  });

  describe('dependencies', () => {
    describe('simple dependency strings', () => {
      it.each`
        input                          | output
        ${'"foo:bar:1.2.3"'}           | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${'"foo:bar:1.2.3@zip"'}       | ${{ depName: 'foo:bar', currentValue: '1.2.3', dataType: 'zip' }}
        ${'"foo:bar1:1"'}              | ${{ depName: 'foo:bar1', currentValue: '1', managerData: { fileReplacePosition: 10 } }}
        ${'"foo:bar:x86@x86"'}         | ${{ depName: 'foo:bar', currentValue: 'x86', managerData: { fileReplacePosition: 9 } }}
        ${'foo.bar = "foo:bar:1.2.3"'} | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      `('$input', ({ input, output }) => {
        const { deps } = parseGradle(input);
        expect(deps).toMatchObject([output]);
      });
    });

    describe('interpolated dependency strings', () => {
      it.each`
        def                                  | str                                    | output
        ${'foo = "1.2.3"'}                   | ${'"foo:bar:$foo@@@"'}                 | ${null}
        ${''}                                | ${'"foo:bar:$baz"'}                    | ${null}
        ${'foo = "1"; bar = "2"; baz = "3"'} | ${'"foo:bar:$foo.$bar.$baz"'}          | ${{ depName: 'foo:bar', currentValue: '1.2.3', skipReason: 'contains-variable' }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:$baz"'}                    | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'foo.bar = "1.2.3"'}               | ${'"foo:bar:$foo.bar"'}                | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'foo.bar' }}
        ${'foo = "1.2.3"'}                   | ${'"foo:bar_$foo:4.5.6"'}              | ${{ depName: 'foo:bar_1.2.3', managerData: { fileReplacePosition: 28 } }}
        ${'foo = "bar"'}                     | ${'"foo:${foo}1:1"'}                   | ${{ depName: 'foo:bar1', currentValue: '1', managerData: { fileReplacePosition: 25 } }}
        ${'bar = "bar:1.2.3"'}               | ${'"foo:$bar"'}                        | ${{ depName: 'foo:bar', currentValue: '1.2.3', skipReason: 'contains-variable' }}
        ${'baz = "1.2.3"'}                   | ${'foobar = "foo:bar:$baz"'}           | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'foo = "${bar}"; baz = "1.2.3"'}   | ${'"foo:bar:${baz}"'}                  | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:${ext[\'baz\']}"'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:${ext.baz}"'}              | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:${project.ext[\'baz\']}"'} | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'a = "foo"; b = "bar"; c="1.2.3"'} | ${'"${a}:${b}:${property("c")}"'}      | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'c' }}
        ${'a = "foo"; b = "bar"; c="1.2.3"'} | ${'"${a}:${b}:${properties["c"]}"'}    | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'c' }}
      `('$def | $str', ({ def, str, output }) => {
        const { deps } = parseGradle([def, str].join('\n'));
        expect(deps).toMatchObject([output].filter(is.truthy));
      });
    });

    describe('concatenated dependency strings', () => {
      it.each`
        def                                  | str                               | output
        ${''}                                | ${'"foo:bar" + ":1.2.3"'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3', managerData: { fileReplacePosition: 15 } }}
        ${''}                                | ${'"foo:bar:" + "1.2.3"'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3', managerData: { fileReplacePosition: 15 } }}
        ${''}                                | ${'"foo:bar:" + "1.2.3@zip"'}     | ${{ depName: 'foo:bar', currentValue: '1.2.3', dataType: 'zip', managerData: { fileReplacePosition: 15 } }}
        ${''}                                | ${'"foo:" + "bar:1.2.3"'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3', managerData: { fileReplacePosition: 15 } }}
        ${''}                                | ${'"foo:bar:1." + "2.3"'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3', skipReason: 'contains-variable' }}
        ${''}                                | ${'"foo:bar1.2.3:" + "1.2.3"'}    | ${{ depName: 'foo:bar1.2.3', currentValue: '1.2.3', managerData: { fileReplacePosition: 20 } }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:" + baz'}             | ${{ depName: 'foo:bar', currentValue: '1.2.3', managerData: { fileReplacePosition: 7 } }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:" + property("baz")'} | ${{ depName: 'foo:bar', currentValue: '1.2.3', managerData: { fileReplacePosition: 7 } }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:" + baz + "456"'}     | ${{ depName: 'foo:bar', currentValue: '1.2.3456', skipReason: 'contains-variable' }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:" + baz + "@zip"'}    | ${{ depName: 'foo:bar', currentValue: '1.2.3', dataType: 'zip', managerData: { fileReplacePosition: 7 } }}
        ${'foo.bar = "bar:"; baz = "1.2.3"'} | ${'"foo:" + foo.bar + "${baz}"'}  | ${{ depName: 'foo:bar', currentValue: '1.2.3', managerData: { fileReplacePosition: 25 } }}
        ${'foo.bar = "bar"; baz = "1.2.3"'}  | ${'"foo:bar_${foo.bar}:" + baz'}  | ${{ depName: 'foo:bar_bar', currentValue: '1.2.3', managerData: { fileReplacePosition: 24 } }}
      `('$def | $str', ({ def, str, output }) => {
        const { deps } = parseGradle([def, str].join('\n'));
        expect(deps).toMatchObject([output]);
      });
    });

    describe('property accessors', () => {
      it.each`
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
          api("foo:bar:$\{${String(accessor)}("baz") as String}")
        `;
        const { deps } = parseGradle(input);
        expect(deps).toMatchObject([
          { depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' },
        ]);
      });
    });

    describe('kotlin() short notation dependencies', () => {
      const output = {
        depName: 'foo',
        packageName: 'org.jetbrains.kotlin:kotlin-foo',
        currentValue: '1.2.3',
      };

      it.each`
        def                | str                                   | output
        ${''}              | ${'kotlin("foo", "1.2.3")'}           | ${output}
        ${''}              | ${'kotlin("foo", version = "1.2.3")'} | ${output}
        ${'some = "foo"'}  | ${'kotlin(some, version = "1.2.3")'}  | ${output}
        ${'some = "foo"'}  | ${'kotlin("${some}", "1.2.3")'}       | ${output}
        ${'baz = "1.2.3"'} | ${'kotlin("foo", baz)'}               | ${{ ...output, groupName: 'baz' }}
        ${'baz = "1.2.3"'} | ${'kotlin("foo", version = baz)'}     | ${output}
        ${'baz = "1.2.3"'} | ${'kotlin("foo", property("baz"))'}   | ${output}
        ${'baz = "1.2.3"'} | ${'kotlin("foo", "${baz}456")'}       | ${{ skipReason: 'unspecified-version' }}
        ${'baz = "1.2.3"'} | ${'kotlin("foo", baz + "456")'}       | ${{ skipReason: 'unspecified-version' }}
        ${''}              | ${'kotlin("foo", some)'}              | ${null}
        ${''}              | ${'kotlin(["foo", "1.2.3"])'}         | ${null}
        ${''}              | ${'kotlin("foo", "1.2.3", "4.5.6")'}  | ${null}
        ${''}              | ${'kotlin("foo", "1.2.3@@@")'}        | ${null}
      `('$def | $str', ({ def, str, output }) => {
        const { deps } = parseGradle([def, str].join('\n'));
        expect(deps).toMatchObject([output].filter(is.truthy));
      });
    });

    describe('map notation dependencies', () => {
      it.each`
        def                | str                                                                               | output
        ${''}              | ${'group: "foo", name: "bar", version: "1.2.3"'}                                  | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${'group: "foo", name: "bar", version: baz'}                                      | ${null}
        ${''}              | ${'group: "foo", name: "bar", version: "1.2.3@@@"'}                               | ${null}
        ${'baz = "1.2.3"'} | ${'group: "foo", name: "bar", version: baz'}                                      | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'some = "foo"'}  | ${'group: property("some"), name: property("some"), version: "1.2.3"'}            | ${{ depName: 'foo:foo', currentValue: '1.2.3' }}
        ${'some = "foo"'}  | ${'group: some, name: some, version: "1.2.3"'}                                    | ${{ depName: 'foo:foo', currentValue: '1.2.3' }}
        ${'some = "foo"'}  | ${'group: "${some}", name: "${some}", version: "1.2.3"'}                          | ${{ depName: 'foo:foo', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'} | ${'group: "foo", name: "bar", version: "${baz}"'}                                 | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'baz = "1.2.3"'} | ${'group: "foo", name: "bar", version: "${baz}456"'}                              | ${{ depName: 'foo:bar', skipReason: 'unspecified-version' }}
        ${''}              | ${'(group: "foo", name: "bar", version: "1.2.3", classifier: "sources")'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${'(group: "foo", name: "bar", version: "1.2.3") {exclude module: "spring-jcl"}'} | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${"implementation platform(group: 'foo', name: 'bar', version: '1.2.3')"}         | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${'(group = "foo", name = "bar", version = "1.2.3")'}                             | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'} | ${'(group = "foo", name = "bar", version = baz)'}                                 | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'some = "foo"'}  | ${'(group = some, name = some, version = "1.2.3")'}                               | ${{ depName: 'foo:foo', currentValue: '1.2.3' }}
        ${'some = "foo"'}  | ${'(group = "${some}", name = "${some}", version = "1.2.3")'}                     | ${{ depName: 'foo:foo', currentValue: '1.2.3' }}
        ${'some = "foo"'}  | ${'(group = "${some}" + some, name = some + "bar" + some, version = "1.2.3")'}    | ${{ depName: 'foofoo:foobarfoo', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'} | ${'(group = "foo", name = "bar", version = "${baz}")'}                            | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'baz = "1.2.3"'} | ${'(group = "foo", name = "bar", version = "${baz}456")'}                         | ${{ depName: 'foo:bar', currentValue: '1.2.3456', skipReason: 'unspecified-version' }}
        ${'baz = "1.2.3"'} | ${'(group = "foo", name = "bar", version = baz + "456")'}                         | ${{ depName: 'foo:bar', currentValue: '1.2.3456', skipReason: 'unspecified-version' }}
        ${''}              | ${'(group = "foo", name = "bar", version = "1.2.3", changing: true)'}             | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      `('$def | $str', ({ def, str, output }) => {
        const { deps } = parseGradle([def, str].join('\n'));
        expect(deps).toMatchObject([output].filter(is.truthy));
      });
    });

    describe('dependencySet dependencies', () => {
      it('simple dependencySet', () => {
        const input = codeBlock`
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

        it.each`
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
          ${'baz = "1.2.3"'}                | ${'dependencySet(group: "foo", version: property("baz")) { entry "bar1"; entry ("bar2") }'}         | ${validOutput1}
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

    describe('plugins', () => {
      it.each`
        def                 | input                                      | output
        ${''}               | ${'id "foo.bar" version "1.2.3"'}          | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id("foo.bar").version("1.2.3")'}        | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id(["foo.bar"]) version "1.2.3"'}       | ${null}
        ${''}               | ${'id("foo", "bar") version "1.2.3"'}      | ${null}
        ${''}               | ${'id "foo".version("1.2.3")'}             | ${null}
        ${''}               | ${'id("foo.bar") version("1.2.3")'}        | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id("foo.bar") version "1.2.3"'}         | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id "foo.bar" version "$baz"'}           | ${{ depName: 'foo.bar', skipReason: 'unspecified-version', currentValue: 'baz' }}
        ${'baz = "1.2.3"'}  | ${'id "foo.bar" version "$baz"'}           | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3', groupName: 'baz' }}
        ${'baz = "1.2.3"'}  | ${'id("foo.bar") version "$baz"'}          | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id "foo.bar" version "x${ab}cd"'}       | ${{ depName: 'foo.bar', skipReason: 'unspecified-version' }}
        ${''}               | ${'id("foo.bar") version "$baz"'}          | ${{ depName: 'foo.bar', skipReason: 'unspecified-version', currentValue: 'baz' }}
        ${''}               | ${'id("foo.bar") version "x${ab}cd"'}      | ${{ depName: 'foo.bar', skipReason: 'unspecified-version' }}
        ${''}               | ${'id("foo.bar") version "1" + "2.3"'}     | ${{ depName: 'foo.bar', skipReason: 'unspecified-version' }}
        ${''}               | ${'id("foo.bar") version property("qux")'} | ${{ depName: 'foo.bar', skipReason: 'unspecified-version' }}
        ${'baz = "1.2.3"'}  | ${'id("foo.bar") version property("baz")'} | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id "foo.bar" version baz'}              | ${{ depName: 'foo.bar', currentValue: 'baz', skipReason: 'unspecified-version' }}
        ${'baz = "1.2.3"'}  | ${'id "foo.bar" version baz'}              | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'}  | ${'id("foo.bar") version baz'}             | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'}  | ${'id("foo.bar").version(baz)'}            | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'kotlin("jvm") version "1.3.71"'}        | ${{ depName: 'org.jetbrains.kotlin.jvm', packageName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.3.71' }}
        ${'baz = "1.3.71"'} | ${'kotlin("jvm") version baz'}             | ${{ depName: 'org.jetbrains.kotlin.jvm', packageName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.3.71', groupName: 'baz' }}
      `('$def | $input', ({ def, input, output }) => {
        const { deps } = parseGradle([def, input].join('\n'));
        expect(deps).toMatchObject([output].filter(is.truthy));
      });
    });
  });

  describe('registries', () => {
    describe('predefined registries', () => {
      it.each`
        input                                          | output
        ${'mavenCentral()'}                            | ${REGISTRY_URLS.mavenCentral}
        ${'google()'}                                  | ${REGISTRY_URLS.google}
        ${'google { content { includeGroup "foo" } }'} | ${REGISTRY_URLS.google}
        ${'gradlePluginPortal()'}                      | ${REGISTRY_URLS.gradlePluginPortal}
        ${'jcenter()'}                                 | ${REGISTRY_URLS.jcenter}
      `('$input', ({ input, output }) => {
        const { urls } = parseGradle(input);
        expect(urls).toMatchObject([{ registryUrl: output }]);
      });
    });

    describe('custom registries', () => {
      it.each`
        def                         | input                                                            | url
        ${''}                       | ${'maven("")'}                                                   | ${null}
        ${''}                       | ${'maven(["https://foo.bar/baz/qux"])'}                          | ${null}
        ${''}                       | ${'maven("foo", "bar")'}                                         | ${null}
        ${''}                       | ${'maven("https://foo.bar/baz")'}                                | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven("${base}/baz")'}                                        | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven(base)'}                                                 | ${'https://foo.bar'}
        ${''}                       | ${'maven(url = "https://foo.bar/baz")'}                          | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven(url = uri("https://foo.bar/baz"))'}                     | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven(uri("https://foo.bar/baz"))'}                           | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven(uri("${base}/baz"))'}                                   | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven(uri(property("base")))'}                                | ${'https://foo.bar'}
        ${'base="https://foo.bar"'} | ${'maven(uri(base))'}                                            | ${'https://foo.bar'}
        ${'base="https://foo.bar"'} | ${'maven(uri(base + "/baz"))'}                                   | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven(uri(["https://foo.bar/baz"]))'}                         | ${null}
        ${''}                       | ${'maven { ["https://foo.bar/baz"] }'}                           | ${null}
        ${''}                       | ${'maven { url "https://foo.bar/baz" }'}                         | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url base + "/baz" }'}                                 | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url "${base}/baz" }'}                                 | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven { url uri("https://foo.bar/baz") }'}                    | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url uri("${base}/baz") }'}                            | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven { url = "https://foo.bar/baz" }'}                       | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url = "${base}/baz" }'}                               | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url = property("base") }'}                            | ${'https://foo.bar'}
        ${'base="https://foo.bar"'} | ${'maven { url = base }'}                                        | ${'https://foo.bar'}
        ${''}                       | ${'maven { url = uri("https://foo.bar/baz") }'}                  | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url = uri("${base}/baz") }'}                          | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url = uri(base) }'}                                   | ${'https://foo.bar'}
        ${''}                       | ${'maven { uri(["https://foo.bar/baz"]) }'}                      | ${null}
        ${'base="https://foo.bar"'} | ${'maven { name "baz"\nurl = "${base}/${name}" }'}               | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { name "${base}" + "/baz"\nurl = "${name}" + "/qux" }'} | ${'https://foo.bar/baz/qux'}
        ${'base="https://foo.bar"'} | ${'maven { name = "baz"\nurl = "${base}/${name}" }'}             | ${'https://foo.bar/baz'}
        ${'some="baz"'}             | ${'maven { name = "${some}"\nurl = "https://foo.bar/${name}" }'} | ${'https://foo.bar/baz'}
        ${'some="foo.bar/baz"'}     | ${'maven { name = property("some")\nurl = "https://${name}" }'}  | ${'https://foo.bar/baz'}
        ${'some="baz"'}             | ${'maven { name = some\nurl = "https://foo.bar/${name}" }'}      | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven { setUrl("https://foo.bar/baz") }'}                     | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven { setUrl(uri("https://foo.bar/baz")) }'}                | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { setUrl("${base}/baz") }'}                             | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { setUrl(project.property("base")) }'}                  | ${'https://foo.bar'}
        ${'base="https://foo.bar"'} | ${'maven { setUrl(base) }'}                                      | ${'https://foo.bar'}
        ${''}                       | ${'maven { setUrl(["https://foo.bar/baz"]) }'}                   | ${null}
        ${''}                       | ${'maven { setUrl("foo", "bar") }'}                              | ${null}
        ${'base="https://foo.bar"'} | ${'publishing { repositories { maven("${base}/baz") } }'}        | ${null}
      `('$def | $input', ({ def, input, url }) => {
        const expected = url ? [{ registryUrl: url }] : [];
        const { urls } = parseGradle([def, input].join('\n'));
        expect(urls).toMatchObject(expected);
      });
    });

    it('pluginManagement', () => {
      const input = codeBlock`
          pluginManagement {
            def fooVersion = "1.2.3"
            repositories {
              mavenLocal()
              maven { url = "https://foo.bar/plugins" }
              gradlePluginPortal()
            }
            plugins {
              id("foo.bar") version "$fooVersion"
            }
          }
          dependencyResolutionManagement {
            repositories {
              maven { url = "https://foo.bar/deps" }
              mavenCentral()
            }
          }
        `;

      const { deps, urls } = parseGradle(input);
      expect(deps).toMatchObject([
        {
          depType: 'plugin',
          depName: 'foo.bar',
          currentValue: '1.2.3',
        },
      ]);
      expect(urls).toMatchObject([
        {
          registryUrl: 'https://foo.bar/plugins',
          scope: 'plugin',
        },
        {
          registryUrl: REGISTRY_URLS.gradlePluginPortal,
          scope: 'plugin',
        },
        {
          registryUrl: 'https://foo.bar/deps',
          scope: 'dep',
        },
        {
          registryUrl: REGISTRY_URLS.mavenCentral,
          scope: 'dep',
        },
      ]);
    });
  });

  describe('version catalog', () => {
    it.each`
      def                                           | str                                                             | output
      ${''}                                         | ${'library("foo.bar", "foo", "bar").version("1.2.3")'}          | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'}                            | ${'library("foo.bar", "foo", "bar").version(baz)'}              | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'}                            | ${'library("foo.bar", "foo", "bar").version("${baz}")'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'}                            | ${'library("foo.bar", "foo", "bar").version(property("baz"))'}  | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'}                            | ${'library("foo.bar", "foo", "bar").version("${baz}xy")'}       | ${{ depName: 'foo:bar', currentValue: '1.2.3xy', skipReason: 'unspecified-version' }}
      ${'baz = "1.2.3"'}                            | ${'library("foo.bar", "foo", "bar").version(baz + ".45")'}      | ${{ depName: 'foo:bar', currentValue: '1.2.3.45', skipReason: 'unspecified-version' }}
      ${'group = "foo"; artifact = "bar"'}          | ${'library("foo.bar", group, artifact).version("1.2.3")'}       | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'f = "foo"; b = "bar"'}                     | ${'library("foo.bar", "${f}", "${b}").version("1.2.3")'}        | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'f = "foo"; b = "bar"; v = "1.2.3"'}        | ${'library("foo.bar", property("f"), "${b}").version(v)'}       | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'f = "foo"; b = "bar"'}                     | ${'library("foo.bar", "${f}" + f, "${b}").version("1.2.3")'}    | ${{ depName: 'foofoo:bar', currentValue: '1.2.3' }}
      ${'version("baz", "1.2.3")'}                  | ${'library("foo.bar", "foo", "bar").versionRef("baz")'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
      ${'library("foo-bar_baz-qux", "foo", "bar")'} | ${'"${libs.foo.bar.baz.qux}:1.2.3"'}                            | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${''}                                         | ${'library(["foo.bar", "foo", "bar"]).version("1.2.3")'}        | ${null}
      ${''}                                         | ${'library("foo", "bar", "baz", "qux").version("1.2.3")'}       | ${null}
      ${''}                                         | ${'library("foo.bar", "foo", "bar").version("1.2.3", "4.5.6")'} | ${null}
      ${''}                                         | ${'library("foo", bar, "baz").version("1.2.3")'}                | ${null}
      ${''}                                         | ${'plugin("foo.bar", "foo").version("1.2.3")'}                  | ${{ depName: 'foo', currentValue: '1.2.3' }}
      ${''}                                         | ${'alias("foo.bar").to("foo", "bar").version("1.2.3")'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'version("baz", "1.2.3")'}                  | ${'alias("foo.bar").to("foo", "bar").versionRef("baz")'}        | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'version("baz", "1.2.3")'}                  | ${'alias("foo.bar").to("foo", "bar").version("${baz}")'}        | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'f = "foo"; b = "bar"; v = "1.2.3"'}        | ${'alias("foo.bar").to(f, b).version(v)'}                       | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'f = "foo"; b = "bar"; v = "1.2.3"'}        | ${'alias("foo.bar").to(f + b, b + f).version(v)'}               | ${{ depName: 'foobar:barfoo', currentValue: '1.2.3' }}
      ${'f = "foo"; b = "bar"; v = "1.2.3"'}        | ${'alias("foo.bar").to("${f}", "${b}").version("$v")'}          | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${''}                                         | ${'alias(["foo.bar"]).to("foo", "bar").version("1.2.3")'}       | ${null}
    `('$def | $str', ({ def, str, output }) => {
      const input = [def, str].join('\n');
      const { deps } = parseGradle(input);
      expect(deps).toMatchObject([output].filter(is.truthy));
    });
  });

  describe('heuristic dependency matching', () => {
    it.each`
      input                                  | output
      ${'("foo", "bar", "1.2.3")'}           | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'("foo", "bar", "1.2.3", "4.5.6")'}  | ${null}
      ${'(["foo", "bar", "1.2.3"])'}         | ${null}
      ${'someMethod("foo", "bar", "1.2.3")'} | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'listOf("foo", "bar", "baz")'}       | ${null}
    `('$input', ({ input, output }) => {
      const { deps } = parseGradle(input);
      expect(deps).toMatchObject([output].filter(is.truthy));
    });
  });

  describe('calculations', () => {
    it('calculates offset', () => {
      const content = "'foo:bar:1.2.3'";
      const { deps } = parseGradle(content);
      const [res] = deps;
      const idx = content
        // TODO #22198
        .slice(res.managerData!.fileReplacePosition)
        .indexOf('1.2.3');
      expect(idx).toBe(0);
    });

    it('parses fixture from "gradle" manager', () => {
      const content = Fixtures.get('build.gradle.example1');
      const { deps } = parseGradle(content, {}, 'build.gradle');
      const replacementIndices = deps.map(({ managerData, currentValue }) =>
        // TODO #22198
        content.slice(managerData!.fileReplacePosition).indexOf(currentValue!),
      );
      expect(replacementIndices.every((idx) => idx === 0)).toBeTrue();
      expect(deps).toMatchSnapshot();
    });
  });

  describe('gradle.properties', () => {
    it.each`
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
        parseProps('foo = bar', 'foo/bar/gradle.properties'),
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

    it.each`
      def                        | input                                                     | output
      ${''}                      | ${'apply from: ""'}                                       | ${{}}
      ${''}                      | ${'apply from: "foo/invalid.gradle"'}                     | ${{}}
      ${''}                      | ${'apply from: "${base}"'}                                | ${{}}
      ${''}                      | ${'apply from: "foo/invalid.non-gradle"'}                 | ${{}}
      ${''}                      | ${'apply from: "https://someurl.com/file.gradle"'}        | ${{}}
      ${''}                      | ${'apply from: "foo/bar.gradle"'}                         | ${validOutput}
      ${'base="foo"'}            | ${'apply from: "${base}/bar.gradle"'}                     | ${validOutput}
      ${'path="foo/bar.gradle"'} | ${'apply from: path'}                                     | ${validOutput}
      ${'path="bar.gradle"'}     | ${'apply from: "foo/" + path'}                            | ${validOutput}
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
      ${'e="o"; b="gradle" '}    | ${'apply from: new File("f" + e + e, "bar." + b)'}        | ${validOutput}
      ${'a="bar"; b="gradle"'}   | ${'apply from: new File("foo", a + "." + "${b}")'}        | ${validOutput}
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
      mockFs(fileContents);
      const { vars } = parseGradle(
        [def, input].join('\n'),
        {},
        '',
        fileContents,
      );
      expect(vars).toMatchObject(output);
    });

    it('recursion check', () => {
      const { vars } = parseGradle(
        'apply from: "foo/bar.gradle"',
        {},
        '',
        fileContents,
        3,
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Max recursion depth reached in script file: foo/bar.gradle',
      );
      expect(vars).toBeEmpty();
    });
  });

  describe('implicit gradle plugins', () => {
    it.each`
      def                | input                                                            | output
      ${'baz = "1.2.3"'} | ${'checkstyle { toolVersion = "${baz}" }'}                       | ${{ depName: 'checkstyle', packageName: GRADLE_PLUGINS['checkstyle'][1], currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'} | ${'checkstyle { toolVersion "${baz}" }'}                         | ${{ depName: 'checkstyle', packageName: GRADLE_PLUGINS['checkstyle'][1], currentValue: '1.2.3' }}
      ${''}              | ${'codenarc { toolVersion = "1.2.3" }'}                          | ${{ depName: 'codenarc', packageName: GRADLE_PLUGINS['codenarc'][1], currentValue: '1.2.3' }}
      ${''}              | ${'detekt { toolVersion = "1.2.3" }'}                            | ${{ depName: 'detekt', packageName: GRADLE_PLUGINS['detekt'][1], currentValue: '1.2.3' }}
      ${''}              | ${'findbugs { toolVersion = "1.2.3" }'}                          | ${{ depName: 'findbugs', packageName: GRADLE_PLUGINS['findbugs'][1], currentValue: '1.2.3' }}
      ${''}              | ${'googleJavaFormat { toolVersion = "1.2.3" }'}                  | ${{ depName: 'googleJavaFormat', packageName: GRADLE_PLUGINS['googleJavaFormat'][1], currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'} | ${'jacoco { toolVersion = baz }'}                                | ${{ depName: 'jacoco', packageName: GRADLE_PLUGINS['jacoco'][1], currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'} | ${'jacoco { toolVersion = property("baz") }'}                    | ${{ depName: 'jacoco', packageName: GRADLE_PLUGINS['jacoco'][1], currentValue: '1.2.3' }}
      ${''}              | ${'lombok { version = "1.2.3" }'}                                | ${{ depName: 'lombok', packageName: GRADLE_PLUGINS['lombok'][1], currentValue: '1.2.3' }}
      ${''}              | ${'lombok { version.set("1.2.3") }'}                             | ${{ depName: 'lombok', packageName: GRADLE_PLUGINS['lombok'][1], currentValue: '1.2.3' }}
      ${''}              | ${'lombok { version.value("1.2.3") }'}                           | ${{ depName: 'lombok', packageName: GRADLE_PLUGINS['lombok'][1], currentValue: '1.2.3' }}
      ${''}              | ${'pmd { toolVersion = "1.2.3" }'}                               | ${{ depName: 'pmd', packageName: GRADLE_PLUGINS['pmd'][1], currentValue: '1.2.3' }}
      ${''}              | ${'pmd { toolVersion.set("1.2.3") }'}                            | ${{ depName: 'pmd', packageName: GRADLE_PLUGINS['pmd'][1], currentValue: '1.2.3' }}
      ${''}              | ${'pmd { toolVersion.value("1.2.3") }'}                          | ${{ depName: 'pmd', packageName: GRADLE_PLUGINS['pmd'][1], currentValue: '1.2.3' }}
      ${''}              | ${'pmd { foo = "bar"; toolVersion = "1.2.3" }'}                  | ${{ depName: 'pmd', packageName: GRADLE_PLUGINS['pmd'][1], currentValue: '1.2.3' }}
      ${''}              | ${'spotbugs { toolVersion = "1.2.3" }'}                          | ${{ depName: 'spotbugs', packageName: GRADLE_PLUGINS['spotbugs'][1], currentValue: '1.2.3' }}
      ${''}              | ${'pmd { toolVersion = "@@@" }'}                                 | ${null}
      ${''}              | ${'pmd { toolVersion = "${baz}" }'}                              | ${null}
      ${'baz = "1.2.3"'} | ${'pmd { toolVersion = "${baz}.456" }'}                          | ${{ depName: 'pmd', currentValue: '1.2.3.456', skipReason: 'unspecified-version' }}
      ${'baz = "1.2.3"'} | ${'pmd { toolVersion = baz + ".456" }'}                          | ${{ depName: 'pmd', currentValue: '1.2.3.456', skipReason: 'unspecified-version' }}
      ${''}              | ${'pmd { [toolVersion = "6.36.0"] }'}                            | ${null}
      ${''}              | ${'unknown { toolVersion = "1.2.3" }'}                           | ${null}
      ${''}              | ${'composeOptions { kotlinCompilerExtensionVersion = "1.2.3" }'} | ${{ depName: 'composeOptions', packageName: GRADLE_PLUGINS['composeOptions'][1], currentValue: '1.2.3' }}
      ${''}              | ${'jmh { jmhVersion = "1.2.3" }'}                                | ${{ depName: 'jmh', packageName: GRADLE_PLUGINS['jmh'][1], currentValue: '1.2.3' }}
    `('$def | $input', ({ def, input, output }) => {
      const { deps } = parseGradle([def, input].join('\n'));
      expect(deps).toMatchObject([output].filter(is.truthy));
    });
  });

  describe('Kotlin object notation', () => {
    it('simple objects', () => {
      const input = codeBlock`
        object Versions {
          const val baz = "1.2.3"
        }

        object Libraries {
          val deps = mapOf("api" to "org.slf4j:slf4j-api:\${Versions.baz}")
          val deps2 = listOf(
            "androidx.appcompat:appcompat:4.5.6",
            "androidx.core:core-ktx:\${Versions.baz}",
            listOf("androidx.webkit:webkit:\${Versions.baz}")
          )
          val dep: String = "foo:bar:" + Versions.baz
        }
      `;

      const res = parseKotlinSource(input);
      expect(res).toMatchObject({
        vars: {
          'Versions.baz': {
            key: 'Versions.baz',
            value: '1.2.3',
          },
        },
        deps: [
          {
            depName: 'org.slf4j:slf4j-api',
            groupName: 'Versions.baz',
            currentValue: '1.2.3',
          },
          {
            depName: 'androidx.appcompat:appcompat',
            currentValue: '4.5.6',
          },
          {
            depName: 'androidx.core:core-ktx',
            groupName: 'Versions.baz',
            currentValue: '1.2.3',
          },
          {
            depName: 'androidx.webkit:webkit',
            groupName: 'Versions.baz',
            currentValue: '1.2.3',
          },
          {
            depName: 'foo:bar',
            groupName: 'Versions.baz',
            currentValue: '1.2.3',
          },
        ],
      });
    });

    it('nested objects', () => {
      const input = codeBlock`
        object Deps {
          const val kotlinVersion = "1.5.31"

          object Kotlin {
            val stdlib = "org.jetbrains.kotlin:kotlin-stdlib-jdk7:\${Deps.kotlinVersion}"
          }

          object Test {
            private const val version = "1.3.0-rc01"
            const val core = "androidx.test:core:\${Deps.Test.version}"

            object Espresso {
              object Release {
                private const val version = "3.3.0-rc01"
                const val espressoCore = "androidx.test.espresso:espresso-core:$version"
              }
            }

            object Androidx {
              const val coreKtx = "androidx.test:core-ktx:$version"
            }
          }
        }
      `;

      const res = parseKotlinSource(input);
      expect(res).toMatchObject({
        vars: {
          'Deps.kotlinVersion': {
            key: 'Deps.kotlinVersion',
            value: '1.5.31',
          },
          'Deps.Test.version': {
            key: 'Deps.Test.version',
            value: '1.3.0-rc01',
          },
          'Deps.Test.Espresso.Release.version': {
            key: 'Deps.Test.Espresso.Release.version',
            value: '3.3.0-rc01',
          },
        },
        deps: [
          {
            depName: 'org.jetbrains.kotlin:kotlin-stdlib-jdk7',
            currentValue: '1.5.31',
            groupName: 'Deps.kotlinVersion',
          },
          {
            depName: 'androidx.test:core',
            currentValue: '1.3.0-rc01',
            groupName: 'Deps.Test.version',
          },
          {
            depName: 'androidx.test.espresso:espresso-core',
            currentValue: '3.3.0-rc01',
            groupName: 'Deps.Test.Espresso.Release.version',
          },
          {
            depName: 'androidx.test:core-ktx',
            currentValue: '1.3.0-rc01',
            groupName: 'Deps.Test.version',
          },
        ],
      });
    });

    it('imported objects', () => {
      const input = codeBlock`
        object ModuleConfiguration {
          object Build {
            object Database {
              const val h2Version = "2.0.206"
            }
          }
        }
      `;

      const gradleKtsInput = codeBlock`
        import ModuleConfiguration.Build.Database
        dependencies {
          runtimeOnly("com.h2database:h2:\${Database.h2Version}")
        }
      `;

      const { vars } = parseKotlinSource(input);
      const res = parseGradle(gradleKtsInput, vars);
      expect(res).toMatchObject({
        vars: {
          'ModuleConfiguration.Build.Database.h2Version': {
            key: 'ModuleConfiguration.Build.Database.h2Version',
            value: '2.0.206',
          },
        },
        deps: [
          {
            depName: 'com.h2database:h2',
            currentValue: '2.0.206',
            groupName: 'ModuleConfiguration.Build.Database.h2Version',
          },
        ],
      });
    });
  });
});
