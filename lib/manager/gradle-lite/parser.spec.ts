import { readFileSync } from 'fs';
import path from 'path';
import { parseGradle, parseProps } from './parser';

const file01 = readFileSync(
  path.resolve(__dirname, './__fixtures__/01.build.gradle'),
  'utf8'
);
const file02 = readFileSync(
  path.resolve(__dirname, './__fixtures__/02.build.gradle'),
  'utf8'
);

describe('manager/gradle-lite/parser', () => {
  it('calculates offset', () => {
    const content = "'foo:bar:1.2.3'";
    const res = parseGradle(content)?.[0];
    expect(
      content.slice(res.managerData.fileReplacePosition).indexOf('1.2.3')
    ).toEqual(0);
  });
  it('build.gradle', () => {
    [file01, file02].forEach((content) => {
      const deps = parseGradle(content);
      deps.forEach((dep) => {
        expect(
          content
            .slice(dep.managerData.fileReplacePosition)
            .indexOf(dep.currentValue)
        ).toEqual(0);
      });
      expect(deps).toMatchSnapshot();
    });
  });
  it('gradle.properties', () => {
    expect(parseProps('foo=bar')).toStrictEqual({
      foo: {
        fileReplacePosition: 4,
        key: 'foo',
        value: 'bar',
      },
    });
    expect(parseProps(' foo = bar ')).toStrictEqual({
      foo: { key: 'foo', value: 'bar', fileReplacePosition: 7 },
    });
    expect(parseProps('foo.bar=baz')).toStrictEqual({
      'foo.bar': { key: 'foo.bar', value: 'baz', fileReplacePosition: 8 },
    });
    expect(parseProps('foo=foo\nbar=bar')).toStrictEqual({
      foo: { key: 'foo', value: 'foo', fileReplacePosition: 4 },
      bar: { key: 'bar', value: 'bar', fileReplacePosition: 12 },
    });
  });
});
