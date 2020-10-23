import { readFileSync } from 'fs';
import path from 'path';
import { parseGradle, parseProps } from './parser';

function getGradleFile(fileName: string): [string, string] {
  const content = readFileSync(
    path.resolve(__dirname, `./__fixtures__/${fileName}`),
    'utf8'
  );
  return [fileName, content];
}

const file01 = getGradleFile('01.build.gradle');
const file02 = getGradleFile('02.build.gradle');
const file03 = getGradleFile('03.build.gradle');
const file04 = getGradleFile('04.build.gradle');
const file05 = getGradleFile('05.build.gradle');
const file06 = getGradleFile('06.build.gradle');
const file07 = getGradleFile('07.build.gradle');

describe('manager/gradle-lite/parser', () => {
  it('calculates offset', () => {
    const content = "'foo:bar:1.2.3'";
    const res = parseGradle(content)?.[0];
    expect(
      content.slice(res.managerData.fileReplacePosition).indexOf('1.2.3')
    ).toEqual(0);
  });
  it('build.gradle', () => {
    [file01, file02, file03, file04, file05, file06, file07].forEach(
      ([packageFile, content]) => {
        const deps = parseGradle(content, {}, packageFile);
        deps.forEach((dep) => {
          expect(
            content
              .slice(dep.managerData.fileReplacePosition)
              .indexOf(dep.currentValue)
          ).toEqual(0);
        });
        expect(deps).toMatchSnapshot();
      }
    );
  });
  it('gradle.properties', () => {
    expect(parseProps('foo=bar')).toStrictEqual({
      vars: {
        foo: {
          fileReplacePosition: 4,
          key: 'foo',
          value: 'bar',
        },
      },
      deps: [],
    });
    expect(parseProps(' foo = bar ')).toStrictEqual({
      vars: {
        foo: { key: 'foo', value: 'bar', fileReplacePosition: 7 },
      },
      deps: [],
    });
    expect(parseProps('foo.bar=baz')).toStrictEqual({
      vars: {
        'foo.bar': { key: 'foo.bar', value: 'baz', fileReplacePosition: 8 },
      },
      deps: [],
    });
    expect(parseProps('foo=foo\nbar=bar')).toStrictEqual({
      vars: {
        foo: { key: 'foo', value: 'foo', fileReplacePosition: 4 },
        bar: { key: 'bar', value: 'bar', fileReplacePosition: 12 },
      },
      deps: [],
    });
    expect(parseProps('x=foo:bar:baz', 'x/gradle.properties')).toStrictEqual({
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
