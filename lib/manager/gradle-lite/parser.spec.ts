import { readFileSync } from 'fs';
import path from 'path';
import { getName } from '../../../test/util';
import { GOOGLE_REPO, JCENTER_REPO, MAVEN_REPO } from './common';
import { parseGradle, parseProps } from './parser';

function getGradleFile(fileName: string): string {
  return readFileSync(path.resolve(__dirname, fileName), 'utf8');
}

describe(getName(__filename), () => {
  it('handles end of input', () => {
    expect(parseGradle('version = ').deps).toBeEmpty();
    expect(parseGradle('id "foo.bar" version').deps).toBeEmpty();
  });
  it('parses variables', () => {
    let deps;

    ({ deps } = parseGradle(
      [
        'version = "1.2.3"',
        '"foo:bar_$version:$version"',
        'version = "3.2.1"',
      ].join('\n')
    ));
    expect(deps).toMatchObject([
      {
        depName: 'foo:bar_1.2.3',
        currentValue: '1.2.3',
      },
    ]);

    ({ deps } = parseGradle(
      [
        'set("version", "1.2.3")',
        '"foo:bar:$version"',
        'set("version", "3.2.1")',
      ].join('\n')
    ));
    expect(deps).toMatchObject([
      {
        depName: 'foo:bar',
        currentValue: '1.2.3',
      },
    ]);

    ({ deps } = parseGradle('version = "1.2.3"\n"foo:bar:$version@@@"'));
    expect(deps).toBeEmpty();
  });
  it('parses registryUrls', () => {
    let urls;

    ({ urls } = parseGradle('url ""'));
    expect(urls).toBeEmpty();

    ({ urls } = parseGradle('url "#!@"'));
    expect(urls).toBeEmpty();

    ({ urls } = parseGradle('url "https://example.com"'));
    expect(urls).toStrictEqual(['https://example.com']);

    ({ urls } = parseGradle('url("https://example.com")'));
    expect(urls).toStrictEqual(['https://example.com']);

    ({ urls } = parseGradle('uri "https://example.com"'));
    expect(urls).toStrictEqual(['https://example.com']);

    ({ urls } = parseGradle(
      'mavenCentral(); uri("https://example.com"); jcenter(); google();'
    ));
    expect(urls).toStrictEqual([
      MAVEN_REPO,
      'https://example.com',
      JCENTER_REPO,
      GOOGLE_REPO,
    ]);
  });
  it('parses long form deps', () => {
    let deps;
    ({ deps } = parseGradle(
      'group: "com.example", name: "my.dependency", version: "1.2.3"'
    ));
    expect(deps).toMatchObject([
      {
        depName: 'com.example:my.dependency',
        currentValue: '1.2.3',
      },
    ]);

    ({ deps } = parseGradle(
      "implementation platform(group: 'foo', name: 'bar', version: '1.2.3')"
    ));
    expect(deps).toMatchObject([
      {
        depName: 'foo:bar',
        currentValue: '1.2.3',
      },
    ]);

    ({ deps } = parseGradle(
      'group: "com.example", name: "my.dependency", version: depVersion'
    ));
    expect(deps).toBeEmpty();

    ({ deps } = parseGradle(
      'depVersion = "1.2.3"\ngroup: "com.example", name: "my.dependency", version: depVersion'
    ));
    expect(deps).toMatchObject([
      {
        depName: 'com.example:my.dependency',
        currentValue: '1.2.3',
      },
    ]);

    ({ deps } = parseGradle('("com.example", "my.dependency", "1.2.3")'));
    expect(deps).toMatchObject([
      {
        depName: 'com.example:my.dependency',
        currentValue: '1.2.3',
      },
    ]);

    ({ deps } = parseGradle(
      '(group = "com.example", name = "my.dependency", version = "1.2.3")'
    ));
    expect(deps).toMatchObject([
      {
        depName: 'com.example:my.dependency',
        currentValue: '1.2.3',
      },
    ]);
  });
  it('parses plugin', () => {
    let deps;

    ({ deps } = parseGradle('id "foo.bar" version "1.2.3"'));
    expect(deps).toMatchObject([
      {
        depName: 'foo.bar',
        lookupName: 'foo.bar:foo.bar.gradle.plugin',
        currentValue: '1.2.3',
      },
    ]);

    ({ deps } = parseGradle('id("foo.bar") version "1.2.3"'));
    expect(deps).toMatchObject([
      {
        depName: 'foo.bar',
        lookupName: 'foo.bar:foo.bar.gradle.plugin',
        currentValue: '1.2.3',
      },
    ]);

    ({ deps } = parseGradle('kotlin("jvm") version "1.3.71"'));
    expect(deps).toMatchObject([
      {
        depName: 'org.jetbrains.kotlin.jvm',
        lookupName:
          'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin',
        currentValue: '1.3.71',
      },
    ]);
  });
  it('parses fixture from "gradle" manager', () => {
    const content = getGradleFile(
      `../gradle/__fixtures__/build.gradle.example1`
    );
    const { deps } = parseGradle(content, {}, 'build.gradle');
    deps.forEach((dep) => {
      expect(
        content
          .slice(dep.managerData.fileReplacePosition)
          .indexOf(dep.currentValue)
      ).toEqual(0);
    });
    expect(deps).toMatchSnapshot();
  });
  it('calculates offset', () => {
    const content = "'foo:bar:1.2.3'";
    const { deps } = parseGradle(content);
    const res = deps[0];
    expect(
      content.slice(res.managerData.fileReplacePosition).indexOf('1.2.3')
    ).toEqual(0);
  });
  it('gradle.properties', () => {
    expect(parseProps('foo=bar')).toMatchObject({
      vars: {
        foo: {
          fileReplacePosition: 4,
          key: 'foo',
          value: 'bar',
        },
      },
      deps: [],
    });
    expect(parseProps(' foo = bar ')).toMatchObject({
      vars: {
        foo: { key: 'foo', value: 'bar', fileReplacePosition: 7 },
      },
      deps: [],
    });
    expect(parseProps('foo.bar=baz')).toMatchObject({
      vars: {
        'foo.bar': { key: 'foo.bar', value: 'baz', fileReplacePosition: 8 },
      },
      deps: [],
    });
    expect(parseProps('foo=foo\nbar=bar')).toMatchObject({
      vars: {
        foo: { key: 'foo', value: 'foo', fileReplacePosition: 4 },
        bar: { key: 'bar', value: 'bar', fileReplacePosition: 12 },
      },
      deps: [],
    });
    expect(parseProps('x=foo:bar:baz', 'x/gradle.properties')).toMatchObject({
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
    });
  });
});
