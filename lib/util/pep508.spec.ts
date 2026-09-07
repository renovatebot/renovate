import { isTruthy } from '@sindresorhus/is';
import {
  dependencyPattern,
  extractPinnedVersion,
  extrasPattern,
  packagePattern,
  parsePep508,
  pep508ToPackageDependency,
  pypiDependency,
  rangePattern,
  repeatedExtrasPattern,
  specifierPattern,
} from './pep508.ts';
import { regEx } from './regex.ts';

describe('util/pep508', () => {
  describe('patterns', () => {
    it('strips named groups from the range pattern', () => {
      expect(rangePattern).not.toContain('?<');
      expect(regEx(`^${specifierPattern}$`).test('>=1.0, !=1.2')).toBe(true);
      expect(regEx(`^${specifierPattern}$`).test('1.0')).toBe(false);
    });

    it.each`
      value                | expected
      ${'a'}               | ${true}
      ${'foo-bar.baz_qux'} | ${true}
      ${'-foo'}            | ${false}
      ${'foo-'}            | ${false}
    `('packagePattern matches $value', ({ value, expected }) => {
      expect(regEx(`^(?:${packagePattern})$`).test(value)).toBe(expected);
    });

    it.each`
      value         | single   | repeated
      ${''}         | ${true}  | ${true}
      ${'[socks]'}  | ${true}  | ${true}
      ${' [socks]'} | ${true}  | ${true}
      ${'[a][b]'}   | ${false} | ${true}
    `('extras patterns match $value', ({ value, single, repeated }) => {
      expect(regEx(`^${extrasPattern}$`).test(value)).toBe(single);
      expect(regEx(`^${repeatedExtrasPattern}$`).test(value)).toBe(repeated);
    });

    it.each`
      value                | expected
      ${'foo'}             | ${true}
      ${'foo[bar]'}        | ${true}
      ${'foo[bar]==1.2.3'} | ${true}
      ${'foo >=1.0, <2.0'} | ${true}
      ${'foo 1.0'}         | ${false}
    `('dependencyPattern matches $value', ({ value, expected }) => {
      expect(regEx(`^${dependencyPattern}$`).test(value)).toBe(expected);
    });
  });

  describe('parsePep508()', () => {
    it.each`
      value                                                        | success  | packageName            | currentValue       | extras                  | marker
      ${''}                                                        | ${false} | ${undefined}           | ${undefined}       | ${undefined}            | ${undefined}
      ${undefined}                                                 | ${false} | ${undefined}           | ${undefined}       | ${undefined}            | ${undefined}
      ${null}                                                      | ${false} | ${undefined}           | ${undefined}       | ${undefined}            | ${undefined}
      ${'blinker'}                                                 | ${true}  | ${'blinker'}           | ${undefined}       | ${undefined}            | ${undefined}
      ${'packaging==20.0.0'}                                       | ${true}  | ${'packaging'}         | ${'==20.0.0'}      | ${undefined}            | ${undefined}
      ${'packaging (==20.0.0)'}                                    | ${true}  | ${'packaging'}         | ${'==20.0.0'}      | ${undefined}            | ${undefined}
      ${'packaging (==20.0.0); python_version < "3.8"'}            | ${true}  | ${'packaging'}         | ${'==20.0.0'}      | ${undefined}            | ${'python_version < "3.8"'}
      ${'packaging>=20.9,!=22.0'}                                  | ${true}  | ${'packaging'}         | ${'>=20.9,!=22.0'} | ${undefined}            | ${undefined}
      ${'cachecontrol[filecache]>=0.12.11'}                        | ${true}  | ${'cachecontrol'}      | ${'>=0.12.11'}     | ${['filecache']}        | ${undefined}
      ${'private-depB[extra1, extra2]~=2.4'}                       | ${true}  | ${'private-depB'}      | ${'~=2.4'}         | ${['extra1', 'extra2']} | ${undefined}
      ${'tomli>=1.1.0; python_version < "3.11"'}                   | ${true}  | ${'tomli'}             | ${'>=1.1.0'}       | ${undefined}            | ${'python_version < "3.11"'}
      ${'typing-extensions; python_version < "3.8"'}               | ${true}  | ${'typing-extensions'} | ${undefined}       | ${undefined}            | ${'python_version < "3.8"'}
      ${'typing-extensions[test-feature]; python_version < "3.8"'} | ${true}  | ${'typing-extensions'} | ${undefined}       | ${['test-feature']}     | ${'python_version < "3.8"'}
    `(
      '(parse $value"',
      ({ value, success, packageName, currentValue, extras, marker }) => {
        const result = parsePep508(value);

        const expected = isTruthy(success)
          ? clear({ packageName, currentValue, extras, marker })
          : null;
        expect(result).toEqual(expected);
      },
    );
  });

  describe('extractPinnedVersion()', () => {
    it.each`
      value         | expected
      ${undefined}  | ${undefined}
      ${null}       | ${undefined}
      ${'>=1.2.3'}  | ${undefined}
      ${'==1.2.3'}  | ${'1.2.3'}
      ${'== 1.2.3'} | ${'1.2.3'}
      ${'===1.2.3'} | ${'=1.2.3'}
    `('($value)', ({ value, expected }) => {
      expect(extractPinnedVersion(value)).toBe(expected);
    });
  });

  describe('pypiDependency()', () => {
    it('normalizes the package name', () => {
      expect(pypiDependency('Foo.Bar')).toEqual({
        depName: 'Foo.Bar',
        packageName: 'foo-bar',
        currentValue: undefined,
        datasource: 'pypi',
      });
    });

    it('sets currentVersion for pinned values and keeps depType', () => {
      expect(pypiDependency('foo', '==1.2.3', 'install')).toEqual({
        depName: 'foo',
        packageName: 'foo',
        datasource: 'pypi',
        depType: 'install',
        currentValue: '==1.2.3',
        currentVersion: '1.2.3',
      });
    });

    it('leaves currentVersion unset for ranges', () => {
      expect(pypiDependency('foo', '>=1.2.3')).toEqual({
        depName: 'foo',
        packageName: 'foo',
        datasource: 'pypi',
        currentValue: '>=1.2.3',
      });
    });
  });

  describe('pep508ToPackageDependency()', () => {
    it('returns null for unparseable values', () => {
      expect(pep508ToPackageDependency('dep', '!!!')).toBeNull();
    });

    it('flags dependencies without a version', () => {
      expect(pep508ToPackageDependency('dep', 'blinker')).toEqual({
        depName: 'blinker',
        packageName: 'blinker',
        datasource: 'pypi',
        depType: 'dep',
        skipReason: 'unspecified-version',
      });
    });

    it('builds a pinned dependency', () => {
      expect(pep508ToPackageDependency('dep', 'blinker==1.6.2')).toEqual({
        depName: 'blinker',
        packageName: 'blinker',
        datasource: 'pypi',
        depType: 'dep',
        currentValue: '==1.6.2',
        currentVersion: '1.6.2',
      });
    });
  });
});

function clear(a: any) {
  Object.keys(a).forEach((key) => {
    if (a[key] === undefined) {
      delete a[key];
    }
  });
  return a;
}
