/* eslint-disable no-template-curly-in-string */
const fs = require('fs');
const path = require('path');
const {
  trimAtKey,
  extractFromVectors,
  extractPackageFile,
} = require('../../../lib/manager/leiningen/extract');

const leinProjectClj = fs.readFileSync(
  path.resolve(__dirname, `./_fixtures/project.clj`),
  'utf8'
);

describe('manager/clojure/extract', () => {
  it('trimAtKey', () => {
    expect(trimAtKey('foo', 'bar')).toBeNull();
    expect(trimAtKey(':dependencies    ', 'dependencies')).toBeNull();
    expect(trimAtKey(':dependencies \nfoobar', 'dependencies')).toEqual(
      'foobar'
    );
  });
  it('extractFromVectors', () => {
    expect(extractFromVectors('')).toEqual([]);
    expect(extractFromVectors('[]')).toEqual([]);
    expect(extractFromVectors('[[]]')).toEqual([]);
    expect(extractFromVectors('[[foo/bar "1.2.3"]]')).toEqual([
      {
        datasource: 'maven',
        depName: 'foo:bar',
        currentValue: '1.2.3',
        fileReplacePosition: 11,
      },
    ]);
    expect(
      extractFromVectors('[\t[foo/bar "1.2.3"]\n["foo/baz"  "4.5.6"] ]')
    ).toEqual([
      {
        datasource: 'maven',
        depName: 'foo:bar',
        currentValue: '1.2.3',
        fileReplacePosition: 12,
      },
      {
        datasource: 'maven',
        depName: 'foo:baz',
        currentValue: '4.5.6',
        fileReplacePosition: 33,
      },
    ]);
  });
  it('extractPackageFile', () => {
    expect(extractPackageFile(leinProjectClj)).toMatchSnapshot();
  });
});
