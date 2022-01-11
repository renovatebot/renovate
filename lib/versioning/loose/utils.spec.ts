import { GenericVersion, GenericVersioningApi } from './generic';

describe('versioning/loose/utils', () => {
  const optionalFunctions = [
    'isLessThanRange',
    'valueToVersion',
    'constructor',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'should',
    'toLocaleString',
    'toString',
    'valueOf',
  ];
  function getAllPropertyNames(obj: any): string[] {
    const props: string[] = [];
    let o = obj;

    do {
      Object.getOwnPropertyNames(o).forEach((prop) => {
        if (!props.includes(prop)) {
          props.push(prop);
        }
      });
    } while ((o = Object.getPrototypeOf(o)));

    return props;
  }

  describe('GenericVersioningApi', () => {
    class DummyScheme extends GenericVersioningApi {
      protected override _compare(_version: string, _other: string): number {
        return _version ? _version.localeCompare(_other) : 0;
      }

      protected _parse(_version: string): GenericVersion | null {
        return _version === 'test' ? null : { release: [1, 0, 0] };
      }
    }

    const api = new DummyScheme();

    it('Scheme keys', () => {
      const schemeKeys = getAllPropertyNames(api)
        .filter(
          (val) => !optionalFunctions.includes(val) && !val.startsWith('_')
        )
        .filter(
          (val) =>
            !['minSatisfyingVersion', 'getSatisfyingVersion'].includes(val)
        )
        .sort();
      expect(schemeKeys).toEqual([
        'equals',
        'getMajor',
        'getMinor',
        'getNewValue',
        'getPatch',
        'isCompatible',
        'isGreaterThan',
        'isSingleVersion',
        'isStable',
        'isValid',
        'isVersion',
        'matches',
        'sortVersions',
      ]);
    });

    it('equals', () => {
      expect(api.equals('', '')).toBe(true);
    });
    it('getMajor', () => {
      expect(api.getMajor('')).toBe(1);
    });
    it('getMinor', () => {
      expect(api.getMinor('')).toBe(0);
    });
    it('getNewValue', () => {
      expect(
        api.getNewValue({
          currentValue: '',
          rangeStrategy: 'auto',
          currentVersion: '',
          newVersion: '',
        })
      ).toBe('');
    });
    it('getPatch', () => {
      expect(api.getPatch('')).toBe(0);
    });
    it('isCompatible', () => {
      expect(api.isCompatible('', '')).toBe(true);
    });
    it('isGreaterThan', () => {
      expect(api.isGreaterThan('', '')).toBe(false);
    });
    it('isSingleVersion', () => {
      expect(api.isSingleVersion('')).toBe(true);
    });
    it('isStable', () => {
      expect(api.isStable('')).toBe(true);
    });
    it('isValid', () => {
      expect(api.isValid('')).toBe(true);
    });
    it('isVersion', () => {
      expect(api.isVersion('')).toBe(true);
    });
    it('matches', () => {
      expect(api.matches('', '')).toBe(true);
    });
    it('sortVersions', () => {
      expect(api.sortVersions('', '')).toBe(0);
    });
    it('isLessThanRange', () => {
      expect(api.isLessThanRange('', '')).toBeFalsy();
    });
    it('minSatisfyingVersion', () => {
      expect(api.minSatisfyingVersion([''], '')).toBeNull();
    });
    it('getSatisfyingVersion', () => {
      expect(api.getSatisfyingVersion([''], '')).toBeNull();
    });
  });
});
