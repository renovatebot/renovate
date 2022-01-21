import { SkipReason } from '../../../../types';
import {
  GOOGLE_REPO,
  GRADLE_PLUGIN_PORTAL_REPO,
  JCENTER_REPO,
  MAVEN_REPO,
} from '../common';
import { parseGradle } from './parser-new';

describe('manager/gradle/shallow/parser/parser-new', () => {
  it('handles end of input', () => {
    expect(parseGradle('version = ').deps).toBeEmpty();
    expect(parseGradle('id "foo.bar" version').deps).toBeEmpty();
  });

  describe('Variable definitions', () => {
    test.each`
      source                             | name                 | value
      ${'version = "1.2.3"'}             | ${'version'}         | ${'1.2.3'}
      ${'foo.bar = "1.2.3"'}             | ${'foo.bar'}         | ${'1.2.3'}
      ${'foo.bar.baz = "1.2.3"'}         | ${'foo.bar.baz'}     | ${'1.2.3'}
      ${'foo .bar. baz . qux = "1.2.3"'} | ${'foo.bar.baz.qux'} | ${'1.2.3'}
      ${'set("version", "1.2.3")'}       | ${'version'}         | ${'1.2.3'}
    `('$source', ({ source, name, value }) => {
      const { vars } = parseGradle(source);
      expect(vars).toContainKey(name);

      const varData = vars[name];
      expect(varData).toMatchObject({ key: name, value });
      expect(varData.packageFile).toBe('build.gradle');
      expect(varData.fileReplacePosition).toBeNumber();
      expect(source.slice(varData.fileReplacePosition)).toStartWith(value);
    });
  });

  describe('Registry URL definitions', () => {
    test.each`
      source                                          | url
      ${'url ""'}                                     | ${null}
      ${'url "#!@"'}                                  | ${null}
      ${'url "https://example.com"'}                  | ${'https://example.com'}
      ${'url("https://example.com")'}                 | ${'https://example.com'}
      ${'mavenCentral()'}                             | ${MAVEN_REPO}
      ${'jcenter()'}                                  | ${JCENTER_REPO}
      ${'google()'}                                   | ${GOOGLE_REPO}
      ${'gradlePluginPortal()'}                       | ${GRADLE_PLUGIN_PORTAL_REPO}
      ${'maven("https://foo.bar/baz/qux")'}           | ${'https://foo.bar/baz/qux'}
      ${'maven { url = uri("https://foo.bar/baz") }'} | ${'https://foo.bar/baz'}
      ${"maven { url 'https://foo.bar/baz' }"}        | ${'https://foo.bar/baz'}
    `('$source', ({ source, url }) => {
      const expected = [url].filter(Boolean);
      const { urls } = parseGradle(source);
      expect(urls).toStrictEqual(expected);
    });
  });

  describe('Dependencies', () => {
    test.each`
      vars                   | dep                                                                       | result
      ${''}                  | ${'"foo:bar:1.2.3"'}                                                      | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${''}                  | ${'"foo:bar:1.2.3@zip"'}                                                  | ${{ depName: 'foo:bar', currentValue: '1.2.3', dataType: 'zip' }}
      ${'baz = "1.2.3"'}     | ${'"foo:bar:$baz@@@"'}                                                    | ${null}
      ${'baz = "1.2.3"'}     | ${'"foo:bar:$baz"'}                                                       | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'"foo:bar:${baz}"'}                                                     | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'"foo:bar:${ baz }"'}                                                   | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz.qux = "1.2.3"'} | ${'"foo:bar:${ baz.qux }"'}                                               | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz.qux' }}
      ${'baz = "1.2.3"'}     | ${'"foo:bar:$baz@zip"'}                                                   | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz', dataType: 'zip' }}
      ${'baz = "1.2.3"'}     | ${'"foo:bar:${baz}@zip"'}                                                 | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz', dataType: 'zip' }}
      ${''}                  | ${'group: "foo", name: "bar", version: "1.2.3"'}                          | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'}     | ${'group: "foo", name: "bar", version: baz'}                              | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
      ${''}                  | ${"implementation platform(group: 'foo', name: 'bar', version: '1.2.3')"} | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${''}                  | ${'(group : "foo", name : "bar", version : "1.2.3")'}                     | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${''}                  | ${'foobar("foo", "bar", "1.2.3")'}                                        | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'}     | ${'foobar("foo", "bar", baz)'}                                            | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
      ${''}                  | ${'id "foo.bar" version "1.2.3"'}                                         | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
      ${''}                  | ${'id("foo.bar") version "1.2.3"'}                                        | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
      ${''}                  | ${'kotlin("jvm") version "1.2.3"'}                                        | ${{ depName: 'org.jetbrains.kotlin.jvm', lookupName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.2.3' }}
      ${'baz = "1.2.3"'}     | ${'id "foo.bar" version baz'}                                             | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'id("foo.bar") version baz'}                                            | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'kotlin("jvm") version baz'}                                            | ${{ depName: 'org.jetbrains.kotlin.jvm', lookupName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'id "foo.bar" version "$baz"'}                                          | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'id("foo.bar") version "$baz"'}                                         | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'kotlin("jvm") version "$baz"'}                                         | ${{ depName: 'org.jetbrains.kotlin.jvm', lookupName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'id "foo.bar" version "${ baz }"'}                                      | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'id("foo.bar") version "${ baz }"'}                                     | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'kotlin("jvm") version "${ baz }"'}                                     | ${{ depName: 'org.jetbrains.kotlin.jvm', lookupName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.2.3', groupName: 'baz' }}
      ${'baz = "1.2.3"'}     | ${'id "foo.bar" version "foo${baz}bar"'}                                  | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', skipReason: SkipReason.UnknownVersion }}
    `(`$dep`, ({ vars, dep, result }) => {
      const input = [vars, dep].join('\n');
      const { deps } = parseGradle(input);
      expect(deps).toMatchObject([result].filter(Boolean));
    });
  });

  // describe('dependencies', () => {
  //   describe('simple cases', () => {
  //     test.each`
  //       input                                                                     | output

  //
  //
  //       ${'("foo", "bar", "1.2.3")'}                                              | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
  //
  //       ${'createXmlValueRemover("defaults", "integer", "integer")'}              | ${{ depName: 'defaults:integer', currentValue: 'integer', skipReason: SkipReason.Ignored }}
  //       ${'"foo:bar:1.2.3@zip"'}                                                  | ${{ currentValue: '1.2.3', dataType: 'zip', depName: 'foo:bar' }}
  //     `('$input', ({ input, output }) => {
  //       const { deps } = parseGradle(in;
  //       expect(deps).toMatchObject([output].filter(Boolean));
  //     });
  //   });

  //   describe('variable substitutions', () => {
  //     test.each`
  //       def                    | str                                          | output
  //       ${'baz = "1.2.3"'}     | ${'"foo:bar:$baz"'}                          | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
  //       ${'foo.bar = "1.2.3"'} | ${'"foo:bar:$foo.bar"'}                      | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'foo.bar' }}
  //       ${'foo = "1.2.3"'}     | ${'"foo:bar_$foo:4.5.6"'}                    | ${{ depName: 'foo:bar_1.2.3', managerData: { fileReplacePosition: 28 } }}
  //       ${''}                  | ${'foo.bar = "foo:bar:1.2.3"'}               | ${{ depName: 'foo:bar', currentValue: '1.2.3' }}
  //       ${'baz = "1.2.3"'}     | ${'foobar = "foo:bar:$baz"'}                 | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
  //       ${'baz = "1.2.3"'}     | ${'group: "foo", name: "bar", version: baz'} | ${{ depName: 'foo:bar', currentValue: '1.2.3', groupName: 'baz' }}
  //     `('$def | $str', ({ def, str, output }) => {
  //       const input = [def, str].join('\n');
  //       const { deps } = parseGradle(in;
  //       expect(deps).toMatchObject([output].filter(Boolean));
  //     });
  //   });

  //   describe('plugins', () => {
  //     test.each`
  //       input                               | output
  //       ${'id "foo.bar" version "1.2.3"'}   | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
  //       ${'id("foo.bar") version "1.2.3"'}  | ${{ depName: 'foo.bar', lookupName: 'foo.bar:foo.bar.gradle.plugin', currentValue: '1.2.3' }}
  //       ${'kotlin("jvm") version "1.2.3"'} | ${{ depName: 'org.jetbrains.kotlin.jvm', lookupName: 'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin', currentValue: '1.2.3' }}
  //     `('$input', ({ input, output }) => {
  //       const { deps } = parseGradle(in;
  //       expect(deps).toMatchObject([output].filter(Boolean));
  //     });
  //   });
  // });

  // describe('registryUrls', () => {
  //   test.each`
  //     input                                           | url
  //     ${'url ""'}                                     | ${null}
  //     ${'url "#!@"'}                                  | ${null}
  //     ${'url "https://example.com"'}                  | ${'https://example.com'}
  //     ${'url("https://example.com")'}                 | ${'https://example.com'}
  //     ${'mavenCentral()'}                             | ${MAVEN_REPO}
  //     ${'jcenter()'}                                  | ${JCENTER_REPO}
  //     ${'google()'}                                   | ${GOOGLE_REPO}
  //     ${'gradlePluginPortal()'}                       | ${GRADLE_PLUGIN_PORTAL_REPO}
  //     ${'maven("https://foo.bar/baz/qux")'}           | ${'https://foo.bar/baz/qux'}
  //     ${'maven { url = uri("https://foo.bar/baz") }'} | ${'https://foo.bar/baz'}
  //     ${"maven { url 'https://foo.bar/baz' }"}        | ${'https://foo.bar/baz'}
  //   `('$input', ({ input, url }) => {
  //     const expected = [url].filter(Boolean);
  //     const { urls } = parseGradle(in;
  //     expect(urls).toStrictEqual(expected);
  //   });
  // });

  // describe('calculations', () => {
  //   it('calculates offset', () => {
  //     const content = "'foo:bar:1.2.3'";
  //     const { deps } = parseGradle(cont;
  //     const [res] = deps;
  //     const idx = content
  //       .slice(res.managerData.fileReplacePosition)
  //       .indexOf('1.2.3');
  //     expect(idx).toBe(0);
  //   });

  //   it('parses fixture from "gradle" manager', () => {
  //     const content = loadFixture('build.gradle.example1', '../deep/');
  //     const { deps } = parseGradle(content, {}, 'build.grad;
  //     const replacementIndices = deps.map(({ managerData, currentValue }) =>
  //       content.slice(managerData.fileReplacePosition).indexOf(currentValue)
  //     );
  //     expect(replacementIndices.every((idx) => idx === 0)).toBeTrue();
  //     expect(deps).toMatchSnapshot();
  //   });
  // });

  // describe('gradle.properties', () => {
  //   test.each`
  //     input            | key          | value    | fileReplacePosition
  //     ${'foo=bar'}     | ${'foo'}     | ${'bar'} | ${4}
  //     ${' foo = bar '} | ${'foo'}     | ${'bar'} | ${7}
  //     ${'foo.bar=baz'} | ${'foo.bar'} | ${'baz'} | ${8}
  //   `('$input', ({ input, key, value, fileReplacePosition }) => {
  //     expect(parseProps(input)).toMatchObject({
  //       vars: { [key]: { key, value, fileReplacePosition } },
  //     });
  //   });

  //   it('handles multi-line file', () => {
  //     expect(parseProps('foo=foo\nbar=bar')).toMatchObject({
  //       vars: {
  //         foo: { key: 'foo', value: 'foo', fileReplacePosition: 4 },
  //         bar: { key: 'bar', value: 'bar', fileReplacePosition: 12 },
  //       },
  //       deps: [],
  //     });
  //   });

  //   it('attaches packageFile', () => {
  //     expect(
  //       parseProps('foo = bar', 'foo/bar/gradle.properties')
  //     ).toMatchObject({
  //       vars: { foo: { packageFile: 'foo/bar/gradle.properties' } },
  //     });
  //   });

  //   it('parses dependencies', () => {
  //     const res = parseProps('dep = foo:bar:1.2.3');

  //     expect(res).toMatchObject({
  //       deps: [
  //         {
  //           currentValue: '1.2.3',
  //           depName: 'foo:bar',
  //           managerData: { fileReplacePosition: 14 },
  //         },
  //       ],
  //     });
  //   });
  // });
});
