/* eslint-disable no-template-curly-in-string */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  trimAtKey,
  extractFromVectors,
  extractPackageFile,
} from '../../../lib/manager/leiningen/extract';

const leinProjectClj = readFileSync(
  resolve(__dirname, `./_fixtures/project.clj`),
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
