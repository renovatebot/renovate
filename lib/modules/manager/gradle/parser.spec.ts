import { Fixtures } from '../../../../test/fixtures';
import { fs, logger } from '../../../../test/util';
import {
  GOOGLE_REPO,
  GRADLE_PLUGIN_PORTAL_REPO,
  JCENTER_REPO,
  MAVEN_REPO,
} from './common';
import { parseGradle, parseProps } from './parser';

jest.mock('../../../util/fs');

function mockFs(files: Record<string, string>): void {
  fs.getSiblingFileName.mockImplementation(
    (existingFileNameWithPath: string, otherFileName: string) => {
      return existingFileNameWithPath
        .slice(0, existingFileNameWithPath.lastIndexOf('/') + 1)
        .concat(otherFileName);
    }
  );

  // TODO: fix types, jest is using wrong overload (#7154)
  fs.readLocalFile.mockImplementation((fileName: string): Promise<any> => {
    const content = files?.[fileName];
    return Promise.resolve(content ?? '');
  });
}

describe('modules/manager/gradle/parser', () => {
  it('handles end of input', async () => {
    expect((await parseGradle('version = ')).deps).toBeEmpty();
    expect((await parseGradle('id "foo.bar" version')).deps).toBeEmpty();
  });

  describe('variables', () => {
    describe('Groovy: single var assignments', () => {
      test.each`
        input                              | name         | value
        ${'foo = "1.2.3"'}                 | ${'foo'}     | ${'1.2.3'}
        ${'foo.bar = "1.2.3"'}             | ${'foo.bar'} | ${'1.2.3'}
        ${'ext.foobar = "1.2.3"'}          | ${'foobar'}  | ${'1.2.3'}
        ${'project.foobar = "1.2.3"'}      | ${'foobar'}  | ${'1.2.3'}
        ${'project.ext.foo.bar = "1.2.3"'} | ${'foo.bar'} | ${'1.2.3'}
        ${'rootProject.foobar = "1.2.3"'}  | ${'foobar'}  | ${'1.2.3'}
        ${'rootProject.foo.bar = "1.2.3"'} | ${'foo.bar'} | ${'1.2.3'}
      `('$input', async ({ input, name, value }) => {
        const { vars } = await parseGradle(input);
        expect(vars).toContainKey(name);
        expect(vars[name]).toMatchObject({ key: name, value });
      });
    });

    describe('Kotlin: single var assignments', () => {
      test.each`
        input                        | name     | value
        ${'set("foo", "1.2.3")'}     | ${'foo'} | ${'1.2.3'}
        ${'version("foo", "1.2.3")'} | ${'foo'} | ${'1.2.3'}
      `('$input', async ({ input, name, value }) => {
        const { vars } = await parseGradle(input);
        expect(vars).toContainKey(name);
        expect(vars[name]).toMatchObject({ key: name, value });
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
      `('$input', async ({ input, output }) => {
        const { deps } = await parseGradle(input);
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });

    describe('interpolated dependency strings', () => {
      test.each`
        def                                  | str                           | output
        ${'foo = "1.2.3"'}                   | ${'"foo:bar:$foo@@@"'}        | ${null}
        ${''}                                | ${'"foo:bar:$baz"'}           | ${null}
        ${'foo = "1"; bar = "2"; baz = "3"'} | ${'"foo:bar:$foo.$bar.$baz"'} | ${{ depName: 'foo:bar', currentValue: '1.2.3', skipReason: 'contains-variable' }}
        ${'baz = "1.2.3"'}                   | ${'"foo:bar:$baz"'}           | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'foo.bar = "1.2.3"'}               | ${'"foo:bar:$foo.bar"'}       | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'foo.bar' }}
        ${'foo = "1.2.3"'}                   | ${'"foo:bar_$foo:4.5.6"'}     | ${{ depName: 'foo:bar_1.2.3', managerData: { fileReplacePosition: 28 } }}
        ${'baz = "1.2.3"'}                   | ${'foobar = "foo:bar:$baz"'}  | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'foo = "${bar}"; baz = "1.2.3"'}   | ${'"foo:bar:${baz}"'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      `('$def | $str', async ({ def, str, output }) => {
        const { deps } = await parseGradle([def, str].join('\n'));
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });

    describe('map notation dependencies', () => {
      test.each`
        def                | str                                                                               | output
        ${''}              | ${'group: "foo", name: "bar", version: "1.2.3"'}                                  | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${'group: "foo", name: "bar", version: baz'}                                      | ${null}
        ${'baz = "1.2.3"'} | ${'group: "foo", name: "bar", version: baz'}                                      | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${''}              | ${'(group: "foo", name: "bar", version: "1.2.3", classifier: "sources")'}         | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${'(group: "foo", name: "bar", version: "1.2.3") {exclude module: "spring-jcl"}'} | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${"implementation platform(group: 'foo', name: 'bar', version: '1.2.3')"}         | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${''}              | ${'(group = "foo", name = "bar", version = "1.2.3")'}                             | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      `('$def | $str', async ({ def, str, output }) => {
        const { deps } = await parseGradle([def, str].join('\n'));
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });

    describe('plugins', () => {
      test.each`
        def                 | input                                 | output
        ${''}               | ${'id "foo.bar" version "1.2.3"'}     | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id(["foo.bar"]) version "1.2.3"'}  | ${null}
        ${''}               | ${'id("foo", "bar") version "1.2.3"'} | ${null}
        ${''}               | ${'id("foo.bar") version "1.2.3"'}    | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id "foo.bar" version "$baz"'}      | ${{ depName: 'foo.bar', skipReason: 'unknown-version', currentValue: 'baz' }}
        ${'baz = "1.2.3"'}  | ${'id "foo.bar" version "$baz"'}      | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'}  | ${'id("foo.bar") version "$baz"'}     | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id "foo.bar" version "x${ab}cd"'}  | ${{ depName: 'foo.bar', skipReason: 'unknown-version' }}
        ${''}               | ${'id("foo.bar") version "$baz"'}     | ${{ depName: 'foo.bar', skipReason: 'unknown-version', currentValue: 'baz' }}
        ${''}               | ${'id("foo.bar") version "x${ab}cd"'} | ${{ depName: 'foo.bar', skipReason: 'unknown-version' }}
        ${''}               | ${'id "foo.bar" version baz'}         | ${{ depName: 'foo.bar', currentValue: 'baz', skipReason: 'unknown-version' }}
        ${'baz = "1.2.3"'}  | ${'id "foo.bar" version baz'}         | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'}  | ${'id("foo.bar") version baz'}        | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'kotlin("jvm") version "1.3.71"'}   | ${{ depName: 'org.jetbrains.kotlin.jvm', packageName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.3.71' }}
        ${'baz = "1.3.71"'} | ${'kotlin("jvm") version baz'}        | ${{ depName: 'org.jetbrains.kotlin.jvm', packageName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.3.71' }}
      `('$def | $input', async ({ def, input, output }) => {
        const { deps } = await parseGradle([def, input].join('\n'));
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });
  });

  describe('registries', () => {
    describe('predefined registries', () => {
      test.each`
        input                                          | output
        ${'mavenCentral()'}                            | ${MAVEN_REPO}
        ${'google()'}                                  | ${GOOGLE_REPO}
        ${'google { content { includeGroup "foo" } }'} | ${GOOGLE_REPO}
        ${'gradlePluginPortal()'}                      | ${GRADLE_PLUGIN_PORTAL_REPO}
        ${'jcenter()'}                                 | ${JCENTER_REPO}
      `('$input', async ({ input, output }) => {
        const { urls } = await parseGradle(input);
        expect(urls).toStrictEqual([output].filter(Boolean));
      });
    });

    describe('custom registries', () => {
      test.each`
        def                         | input                                                | url
        ${''}                       | ${'maven("")'}                                       | ${null}
        ${''}                       | ${'maven(["https://foo.bar/baz/qux"])'}              | ${null}
        ${''}                       | ${'maven("foo", "bar")'}                             | ${null}
        ${''}                       | ${'maven("https://foo.bar/baz")'}                    | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven("${base}/baz")'}                            | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven(uri(["https://foo.bar/baz"]))'}             | ${null}
        ${''}                       | ${'maven { ["https://foo.bar/baz"] }'}               | ${null}
        ${''}                       | ${'maven { url "https://foo.bar/baz" }'}             | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url "${base}/baz" }'}                     | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven { url = "https://foo.bar/baz" }'}           | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url = "${base}/baz" }'}                   | ${'https://foo.bar/baz'}
        ${''}                       | ${'maven { url = uri("https://foo.bar/baz") }'}      | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { url = uri("${base}/baz") }'}              | ${'https://foo.bar/baz'}
        ${'base="https://foo.bar"'} | ${'maven { name = "baz"\nurl = "${base}/${name}" }'} | ${'https://foo.bar/baz'}
      `('$def | $input', async ({ def, input, url }) => {
        const expected = [url].filter(Boolean);
        const { urls } = await parseGradle([def, input].join('\n'));
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
      ${''}                                         | ${'library("foo", "bar", "baz", "qux"]).version("1.2.3")'}      | ${null}
      ${''}                                         | ${'library("foo.bar", "foo", "bar").version("1.2.3", "4.5.6")'} | ${null}
      ${'group = "foo"; artifact="bar"'}            | ${'library("foo.bar", group, artifact).version("1.2.3")'}       | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'library("foo-bar_baz-qux", "foo", "bar")'} | ${'"${foo.bar.baz.qux}:1.2.3"'}                                 | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
    `('$def | $str', async ({ def, str, output }) => {
      const input = [def, str].join('\n');
      const { deps } = await parseGradle(input);
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
    `('$input', async ({ input, output }) => {
      const { deps } = await parseGradle(input);
      expect(deps).toMatchObject([output].filter(Boolean));
    });
  });

  describe('calculations', () => {
    it('calculates offset', async () => {
      const content = "'foo:bar:1.2.3'";
      const { deps } = await parseGradle(content);
      const [res] = deps;
      const idx = content
        // TODO #7154
        .slice(res.managerData!.fileReplacePosition)
        .indexOf('1.2.3');
      expect(idx).toBe(0);
    });

    it('parses fixture from "gradle" manager', async () => {
      const content = Fixtures.get('build.gradle.example1');
      const { deps } = await parseGradle(content, {}, 'build.gradle');
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
      def                    | input                                               | output
      ${''}                  | ${'apply from: ""'}                                 | ${{}}
      ${''}                  | ${'apply from: "foo/invalid.gradle"'}               | ${{}}
      ${''}                  | ${'apply from: "${base}"'}                          | ${{}}
      ${''}                  | ${'apply from: "foo/invalid.non-gradle"'}           | ${{}}
      ${''}                  | ${'apply from: "https://someurl.com/file.gradle"'}  | ${{}}
      ${''}                  | ${'apply from: "foo/bar.gradle"'}                   | ${validOutput}
      ${'base="foo"'}        | ${'apply from: "${base}/bar.gradle"'}               | ${validOutput}
      ${''}                  | ${'apply from: file("foo/bar.gradle")'}             | ${validOutput}
      ${'base="foo"'}        | ${'apply from: file("${base}/bar.gradle")'}         | ${validOutput}
      ${''}                  | ${'apply from: project.file("foo/bar.gradle")'}     | ${validOutput}
      ${''}                  | ${'apply from: rootProject.file("foo/bar.gradle")'} | ${validOutput}
      ${''}                  | ${'apply from: new File("foo/bar.gradle")'}         | ${validOutput}
      ${'base="foo"'}        | ${'apply from: new File("${base}/bar.gradle")'}     | ${validOutput}
      ${''}                  | ${'apply from: new File("foo", "bar.gradle")'}      | ${validOutput}
      ${'base="foo"'}        | ${'apply from: new File(base, "bar.gradle")'}       | ${validOutput}
      ${'base="foo"'}        | ${'apply from: new File("${base}", "bar.gradle")'}  | ${validOutput}
      ${'path="bar.gradle"'} | ${'apply from: new File("foo", "${path}")'}         | ${validOutput}
      ${''}                  | ${'apply(from = "foo/bar.gradle"))'}                | ${validOutput}
      ${'base="foo"'}        | ${'apply(from = "${base}/bar.gradle"))'}            | ${validOutput}
      ${''}                  | ${'apply(from = File("foo/bar.gradle"))'}           | ${validOutput}
      ${''}                  | ${'apply(from = File("foo", "bar", "baz"))'}        | ${{}}
      ${''}                  | ${'apply(from = File(["${somedir}/foo.gradle"]))'}  | ${{}}
      ${'base="foo"'}        | ${'apply(from = File("${base}/bar.gradle"))'}       | ${validOutput}
      ${''}                  | ${'apply(from = File("foo", "bar.gradle"))'}        | ${validOutput}
      ${'base="foo"'}        | ${'apply(from = File(base, "bar.gradle"))'}         | ${validOutput}
      ${'base="foo"'}        | ${'apply(from = File("${base}", "bar.gradle"))'}    | ${validOutput}
    `('$def | $input', async ({ def, input, output }) => {
      const { vars } = await parseGradle([def, input].join('\n'));
      expect(vars).toMatchObject(output);
    });

    it('recursion check', async () => {
      const { vars } = await parseGradle(
        'apply from: "foo/bar.gradle"',
        {},
        '',
        3
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Max recursion depth reached in script file: foo/bar.gradle'
      );
      expect(vars).toBeEmpty();
    });
  });
});
