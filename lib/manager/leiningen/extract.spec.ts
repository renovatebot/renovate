import { getName, loadFixture } from '../../../test/util';
import { ClojureDatasource } from '../../datasource/clojure';
import {
  extractFromVectors,
  extractPackageFile,
  extractVariables,
  trimAtKey,
} from './extract';

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
      extractFromVectors('[[foo/bar ~baz]]', {}, { baz: '1.2.3' })
    ).toEqual([
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
  it('extractVariables', () => {
    expect(extractVariables('(def foo "1")')).toEqual({ foo: '1' });
    expect(extractVariables('(def foo"2")')).toEqual({ foo: '2' });
    expect(extractVariables('(def foo "3")\n(def bar "4")')).toEqual({
      foo: '3',
      bar: '4',
    });
  });
});
