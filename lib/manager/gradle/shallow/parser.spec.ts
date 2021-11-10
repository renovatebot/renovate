import { loadFixture } from '../../../../test/util';
import { SkipReason } from '../../../types';
import {
  GOOGLE_REPO,
  GRADLE_PLUGIN_PORTAL_REPO,
  JCENTER_REPO,
  MAVEN_REPO,
} from './common';
import { parseGradle, parseProps } from './parser';

let testData = [
  {
    name: 'parses variables',
    inputs: [
      ['version = "1.2.3"', '"foo:bar_$version:$version"', 'version = "3.2.1"'],
      [
        'set("version", "1.2.3")',
        '"foo:bar_$version:$version"',
        'set("version", "3.2.1")',
      ],
    ],
    output: [
      {
        depName: 'foo:bar_1.2.3',
        currentValue: '1.2.3',
      },
    ],
  },
  {
    name: 'parses variables not working',
    inputs: [['version = "1.2.3"', '"foo:bar:$version@@@"']],
    output: [],
  },
  {
    name: 'parses variables',
    inputs: [
      ['versions.foobar = "1.2.3"', '"foo:bar:${versions.foobar}"'],
      ['versions.foobar = "1.2.3"', '"foo:bar:$versions.foobar"'],
    ],
    output: [
      {
        depName: 'foo:bar',
        currentValue: '1.2.3',
        groupName: 'versions.foobar',
      },
    ],
  },

  // Long form deps
  {
    name: 'parse long form deps',
    inputs: [
      ['group: "foo", name: "bar", version: "1.2.3"'],
      ["implementation platform(group: 'foo', name: 'bar', version: '1.2.3')"],
      ['depVersion = "1.2.3"\ngroup: "foo", name: "bar", version: depVersion'],
      ['("foo", "bar", "1.2.3")'],
      ['(group = "foo", name = "bar", version = "1.2.3")'],
    ],
    output: [
      {
        depName: 'foo:bar',
        currentValue: '1.2.3',
      },
    ],
  },
  {
    name: 'parse long form deps',
    inputs: [['createXmlValueRemover("defaults", "integer", "integer")']],
    output: [
      {
        depName: 'defaults:integer',
        currentValue: 'integer',
        skipReason: SkipReason.Ignored,
      },
    ],
  },
  {
    name: 'parse long form deps',
    inputs: [
      ['group: "com.example", name: "my.dependency", version: depVersion'],
    ],
    output: [],
  },

  // Plugins
  {
    name: 'parses plugins',
    inputs: [
      ['id "foo.bar" version "1.2.3"'],
      ['id "foo.bar" version "1.2.3" apply false'],
      ['id("foo.bar") version "1.2.3"'],
      ['id("foo.bar") version "1.2.3" apply false'],
      ['version = "1.2.3"', 'id "foo.bar" version "$version"'],
      ['version = "1.2.3"', 'id "foo.bar" version "$version" apply false'],
      ['version = "1.2.3"', 'id "foo.bar" version "${version}"'],
      ['version = "1.2.3"', 'id "foo.bar" version "${version}" apply false'],
      ['version = "1.2.3"', 'id("foo.bar") version "${version}"'],
      ['version = "2.3"', 'id "foo.bar" version "1.${version}"'],
      ['version = "2.3"', 'id("foo.bar") version "1.${version}"'],
    ],
    output: [
      {
        depName: 'foo.bar',
        lookupName: 'foo.bar:foo.bar.gradle.plugin',
        currentValue: '1.2.3',
      },
    ],
  },
  {
    name: 'parses plugins',
    inputs: [
      ['kotlin("jvm") version "1.2.3"'],
      ['version = "1.2.3"', 'kotlin("jvm") version "${version}"'],
      ['version = "1.2.3"', 'kotlin("jvm") version "$version"'],
      ['version = "2.3"', 'kotlin("jvm") version "1.${version}"'],
    ],
    output: [
      {
        depName: 'org.jetbrains.kotlin.jvm',
        lookupName:
          'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin',
        currentValue: '1.2.3',
      },
    ],
  },
];

describe('manager/gradle/shallow/parser', () => {
  it('handles end of input', () => {
    expect(parseGradle('version = ').deps).toBeEmpty();
    expect(parseGradle('id "foo.bar" version').deps).toBeEmpty();
  });
  let deps;
  testData.forEach((test) => {
    describe(test.name, () => {
      test.inputs.forEach((input) => {
        it(`${input.join(' \t ')}`, () => {
          ({ deps } = parseGradle(input.join('\n')));
          expect(deps).toMatchObject(test.output);
        });
      });
    });
  });
  describe('parses variables', () => {
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

  let testUrls = [
    {
      name: 'parses registryUrls',
      inputs: [
        'url "https://example.com"',
        'url("https://example.com")',
        'uri "https://example.com"',
        'maven("https://example.com")',
        'maven { url = uri("https://example.com") }',
        "maven { url 'https://example.com' }",
        'maven "https://example.com"',
        'var="https://example.com"\nmaven("$var")',
        'var="https://example.com"\nmaven(var)',
        'var=".com"\nmaven("https://example${var}")',
      ],
      output: ['https://example.com'],
    },
    {
      name: 'parses registryUrls not working',
      inputs: [
        'url ""',
        'url "#!@"',
        'url("")',
        'uri ""',
        'maven("")',
        'maven { url = uri("") }',
        "maven { url '' }",
      ],
      output: [],
    },
  ];
  let urls;

  testUrls.forEach((test) => {
    describe(test.name, () => {
      test.inputs.forEach((input) => {
        it(`${input}`, () => {
          ({ urls } = parseGradle(input));
          expect(urls).toStrictEqual(test.output);
        });
      });
    });
  });
  describe('parses registryUrls', () => {
    test('registry order', () => {
      ({ urls } = parseGradle(
        'mavenCentral(); uri("https://example.com"); jcenter(); google(); gradlePluginPortal();'
      ));
      expect(urls).toStrictEqual([
        MAVEN_REPO,
        'https://example.com',
        JCENTER_REPO,
        GOOGLE_REPO,
        GRADLE_PLUGIN_PORTAL_REPO,
      ]);
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
