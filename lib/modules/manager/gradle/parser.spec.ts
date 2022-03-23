import { loadFixture } from '../../../../test/util';
import {
  GOOGLE_REPO,
  GRADLE_PLUGIN_PORTAL_REPO,
  JCENTER_REPO,
  MAVEN_REPO,
} from './common';
import { parseGradle, parseProps } from './parser';

describe('modules/manager/gradle/parser', () => {
  it('handles end of input', () => {
    expect(parseGradle('version = ').deps).toBeEmpty();
    expect(parseGradle('id "foo.bar" version').deps).toBeEmpty();
  });

  describe('variable assignments', () => {
    test.each`
      input                          | name                 | value
      ${'version = "1.2.3"'}         | ${'version'}         | ${'1.2.3'}
      ${'set("version", "1.2.3")'}   | ${'version'}         | ${'1.2.3'}
      ${'versions.foobar = "1.2.3"'} | ${'versions.foobar'} | ${'1.2.3'}
    `('$input', ({ input, name, value }) => {
      const { vars } = parseGradle(input);
      expect(vars).toContainKey(name);
      expect(vars[name]).toMatchObject({ key: name, value });
    });
  });

  describe('dependencies', () => {
    describe('simple cases', () => {
      test.each`
        input                                                                     | output
        ${'group: "foo", name: "bar", version: "1.2.3"'}                          | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${"implementation platform(group: 'foo', name: 'bar', version: '1.2.3')"} | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${'group: "foo", name: "bar", version: depVersion'}                       | ${null}
        ${'("foo", "bar", "1.2.3")'}                                              | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${'(group = "foo", name = "bar", version = "1.2.3")'}                     | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${'createXmlValueRemover("defaults", "integer", "integer")'}              | ${{ depName: 'defaults:integer', currentValue: 'integer', skipReason: 'ignored' }}
        ${'"foo:bar:1.2.3@zip"'}                                                  | ${{ currentValue: '1.2.3', dataType: 'zip', depName: 'foo:bar' }}
      `('$input', ({ input, output }) => {
        const { deps } = parseGradle(input);
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });

    describe('variable substitutions', () => {
      test.each`
        def                    | str                                          | output
        ${'foo = "1.2.3"'}     | ${'"foo:bar:$foo@@@"'}                       | ${null}
        ${'baz = "1.2.3"'}     | ${'"foo:bar:$baz"'}                          | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'foo.bar = "1.2.3"'} | ${'"foo:bar:$foo.bar"'}                      | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'foo.bar' }}
        ${'foo = "1.2.3"'}     | ${'"foo:bar_$foo:4.5.6"'}                    | ${{ depName: 'foo:bar_1.2.3', managerData: { fileReplacePosition: 28 } }}
        ${''}                  | ${'foo.bar = "foo:bar:1.2.3"'}               | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'}     | ${'foobar = "foo:bar:$baz"'}                 | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
        ${'baz = "1.2.3"'}     | ${'group: "foo", name: "bar", version: baz'} | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
      `('$def | $str', ({ def, str, output }) => {
        const input = [def, str].join('\n');
        const { deps } = parseGradle(input);
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });

    describe('plugins', () => {
      test.each`
        def                 | input                               | output
        ${''}               | ${'id "foo.bar" version "1.2.3"'}   | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id("foo.bar") version "1.2.3"'}  | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'kotlin("jvm") version "1.3.71"'} | ${{ depName: 'org.jetbrains.kotlin.jvm', packageName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.3.71' }}
        ${''}               | ${'id "foo.bar" version something'} | ${{ depName: 'foo.bar', currentValue: 'something', skipReason: 'unknown-version' }}
        ${'baz = "1.2.3"'}  | ${'id "foo.bar" version baz'}       | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${'baz = "1.2.3"'}  | ${'id("foo.bar") version baz'}      | ${{ depName: 'foo.bar', packageName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
        ${'baz = "1.3.71"'} | ${'kotlin("jvm") version baz'}      | ${{ depName: 'org.jetbrains.kotlin.jvm', packageName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.3.71' }}
        ${'z = "1.2.3"'}    | ${'id "x.y" version "$z"'}          | ${{ depName: 'x.y', packageName: 'x.y:x.y.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id "x.y" version "$z"'}          | ${{ depName: 'x.y', skipReason: 'unknown-version', currentValue: 'z' }}
        ${''}               | ${'id "x.y" version "x${y}z"'}      | ${{ depName: 'x.y', skipReason: 'unknown-version' }}
        ${'z = "1.2.3"'}    | ${'id("x.y") version "$z"'}         | ${{ depName: 'x.y', packageName: 'x.y:x.y.gradle.plugin', currentValue: '1.2.3' }}
        ${''}               | ${'id("x.y") version "$z"'}         | ${{ depName: 'x.y', skipReason: 'unknown-version', currentValue: 'z' }}
        ${''}               | ${'id("x.y") version "x${y}z"'}     | ${{ depName: 'x.y', skipReason: 'unknown-version' }}
      `('$input', ({ def, input, output }) => {
        const { deps } = parseGradle([def, input].join('\n'));
        expect(deps).toMatchObject([output].filter(Boolean));
      });
    });
  });

  describe('registryUrls', () => {
    test.each`
      input                                           | url
      ${'url ""'}                                     | ${null}
      ${'url "#!@"'}                                  | ${null}
      ${'url "https://example.com"'}                  | ${'https://example.com'}
      ${'url("https://example.com")'}                 | ${'https://example.com'}
      ${'mavenCentral()'}                             | ${MAVEN_REPO}
      ${'jcenter()'}                                  | ${JCENTER_REPO}
      ${'google()'}                                   | ${GOOGLE_REPO}
      ${'google { content { includeGroup "foo" } }'}  | ${GOOGLE_REPO}
      ${'gradlePluginPortal()'}                       | ${GRADLE_PLUGIN_PORTAL_REPO}
      ${'maven("https://foo.bar/baz/qux")'}           | ${'https://foo.bar/baz/qux'}
      ${'maven { url = uri("https://foo.bar/baz") }'} | ${'https://foo.bar/baz'}
      ${"maven { url 'https://foo.bar/baz' }"}        | ${'https://foo.bar/baz'}
    `('$input', ({ input, url }) => {
      const expected = [url].filter(Boolean);
      const { urls } = parseGradle(input);
      expect(urls).toStrictEqual(expected);
    });
  });

  describe('calculations', () => {
    it('calculates offset', () => {
      const content = "'foo:bar:1.2.3'";
      const { deps } = parseGradle(content);
      const [res] = deps;
      const idx = content
        .slice(res.managerData.fileReplacePosition)
        .indexOf('1.2.3');
      expect(idx).toBe(0);
    });

    it('parses fixture from "gradle" manager', () => {
      const content = loadFixture('build.gradle.example1');
      const { deps } = parseGradle(content, {}, 'build.gradle');
      const replacementIndices = deps.map(({ managerData, currentValue }) =>
        content.slice(managerData.fileReplacePosition).indexOf(currentValue)
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
});
