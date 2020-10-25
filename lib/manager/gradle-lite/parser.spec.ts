import { readFileSync } from 'fs';
import path from 'path';
import { parseGradle, parseProps } from './parser';

function getGradleFile(fileName: string): string {
  return readFileSync(path.resolve(__dirname, fileName), 'utf8');
}

describe('manager/gradle-lite/parser', () => {
  it('handles end of input', () => {
    expect(parseGradle('version = ')).toBeEmpty();
    expect(parseGradle('id "foo.bar" version')).toBeEmpty();
  });
  it('parses variables', () => {
    expect(
      parseGradle('version = "1.2.3"\n"foo:bar:$version"\nversion = "3.2.1"')
    ).toMatchObject([
      {
        depName: 'foo:bar',
        currentValue: '1.2.3',
      },
    ]);
    expect(parseGradle('version = "1.2.3"\n"foo:bar:$version@@@"')).toBeEmpty();
  });
  it('parses plugin', () => {
    expect(parseGradle('id "foo.bar" version "1.2.3"')).toMatchObject([
      {
        depName: 'foo.bar',
        lookupName: 'foo.bar:foo.bar.gradle.plugin',
        currentValue: '1.2.3',
      },
    ]);
  });
  it('parses fixture from "gradle" manager', () => {
    const content = getGradleFile(
      `../gradle/__fixtures__/build.gradle.example1`
    );
    const deps = parseGradle(content, {}, 'build.gradle');
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
    const res = parseGradle(content)?.[0];
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
