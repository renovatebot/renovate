import { getName, loadFixture } from '../../../test/util';
import { ClojureDatasource } from '../../datasource/clojure';
import { extractFromVectors, extractPackageFile, trimAtKey } from './extract';

const leinProjectClj = loadFixture(`project.clj`);

describe(getName(), () => {
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
        datasource: ClojureDatasource.id,
        depName: 'foo:bar',
        currentValue: '1.2.3',
      },
    ]);
    expect(
      extractFromVectors('[\t[foo/bar "1.2.3"]\n["foo/baz"  "4.5.6"] ]')
    ).toEqual([
      {
        datasource: ClojureDatasource.id,
        depName: 'foo:bar',
        currentValue: '1.2.3',
      },
      {
        datasource: ClojureDatasource.id,
        depName: 'foo:baz',
        currentValue: '4.5.6',
      },
    ]);
  });
  it('extractPackageFile', () => {
    expect(extractPackageFile(leinProjectClj)).toMatchSnapshot();
  });
});
