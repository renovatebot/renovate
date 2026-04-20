import { isTruthy } from '@sindresorhus/is';
import {
  extractPythonConstraintFromMarker,
  parsePEP508,
  pep508ToPackageDependency,
  pythonConstraintToMarkerSlug,
} from './utils.ts';

describe('modules/manager/pep621/utils', () => {
  describe('parsePEP508()', () => {
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
        const result = parsePEP508(value);

        const expected = isTruthy(success)
          ? clear({ packageName, currentValue, extras, marker })
          : null;
        expect(result).toEqual(expected);
      },
    );
  });

  describe('pep508ToPackageDependency()', () => {
    it('should store marker and pep508String in managerData when marker is present', () => {
      const result = pep508ToPackageDependency(
        'project.dependencies',
        'pytest>=6.0,<7.0; python_version < "3.10"',
      );
      expect(result).toMatchObject({
        packageName: 'pytest',
        currentValue: '>=6.0,<7.0',
        managerData: {
          marker: 'python_version < "3.10"',
          pep508String: 'pytest>=6.0,<7.0; python_version < "3.10"',
        },
      });
      expect(result?.replaceString).toBeUndefined();
    });

    it('should not set managerData or replaceString when no marker', () => {
      const result = pep508ToPackageDependency(
        'project.dependencies',
        'pytest>=6.0,<7.0',
      );
      expect(result).toMatchObject({
        packageName: 'pytest',
        currentValue: '>=6.0,<7.0',
      });
      expect(result?.managerData).toBeUndefined();
      expect(result?.replaceString).toBeUndefined();
    });
  });

  describe('extractPythonConstraintFromMarker()', () => {
    it('should extract >= constraint', () => {
      expect(
        extractPythonConstraintFromMarker('python_version >= "3.10"'),
      ).toBe('>=3.10');
    });

    it('should extract == constraint', () => {
      expect(extractPythonConstraintFromMarker('python_version == "3.9"')).toBe(
        '==3.9',
      );
    });

    it('should extract < constraint', () => {
      expect(extractPythonConstraintFromMarker('python_version < "3.10"')).toBe(
        '<3.10',
      );
    });

    it('should extract constraint from single-quoted marker', () => {
      expect(
        extractPythonConstraintFromMarker("python_version >= '3.10'"),
      ).toBe('>=3.10');
    });

    it('should extract python_full_version constraint', () => {
      expect(
        extractPythonConstraintFromMarker('python_full_version >= "3.10.0"'),
      ).toBe('>=3.10.0');
    });

    it('should extract ~= constraint', () => {
      expect(
        extractPythonConstraintFromMarker('python_version ~= "3.10"'),
      ).toBe('~=3.10');
    });

    it('should return null for non-Python marker', () => {
      expect(
        extractPythonConstraintFromMarker('sys_platform == "win32"'),
      ).toBeNull();
    });

    it('should return null for complex marker with and', () => {
      expect(
        extractPythonConstraintFromMarker(
          'python_version >= "3.10" and sys_platform == "linux"',
        ),
      ).toBeNull();
    });

    it('should return null for complex marker with or', () => {
      expect(
        extractPythonConstraintFromMarker(
          'python_version >= "3.10" or python_version == "3.9"',
        ),
      ).toBeNull();
    });
  });

  describe('pythonConstraintToMarkerSlug()', () => {
    it('should handle >= operator', () => {
      expect(pythonConstraintToMarkerSlug('>=3.10')).toBe('py310plus');
    });

    it('should handle == operator', () => {
      expect(pythonConstraintToMarkerSlug('==3.9')).toBe('py39');
    });

    it('should handle < operator', () => {
      expect(pythonConstraintToMarkerSlug('<3.10')).toBe('pylt310');
    });

    it('should handle > operator', () => {
      expect(pythonConstraintToMarkerSlug('>3.10')).toBe('py310gt');
    });

    it('should handle <= operator', () => {
      expect(pythonConstraintToMarkerSlug('<=3.10')).toBe('pylte310');
    });

    it('should handle != operator', () => {
      expect(pythonConstraintToMarkerSlug('!=3.9')).toBe('pyne39');
    });

    it('should handle ~= operator', () => {
      expect(pythonConstraintToMarkerSlug('~=3.10')).toBe('pycompat310');
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
