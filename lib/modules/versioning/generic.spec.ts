import { partial } from '../../../test/util';
import type { GenericVersion } from './generic';
import { GenericVersioningApi } from './generic';
import type { NewValueConfig } from './types';

describe('modules/versioning/generic', () => {
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
      protected _parse(_version: string): GenericVersion | null {
        const matchGroups = _version.match(
          /^(?<major>\d)\.(?<minor>\d)\.(?<patch>\d)(?:-(?<prerelease>.+))?$/,
        )?.groups;
        if (!matchGroups) {
          return null;
        }
        const { major, minor, patch, prerelease } = matchGroups;
        return {
          release: [major, minor, patch].map((n) => parseInt(n, 10)),
          prerelease,
        };
      }
    }

    const api = new DummyScheme();

    it('Scheme keys', () => {
      const schemeKeys = getAllPropertyNames(api)
        .filter(
          (val) => !optionalFunctions.includes(val) && !val.startsWith('_'),
        )
        .filter(
          (val) =>
            !['minSatisfyingVersion', 'getSatisfyingVersion'].includes(val),
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
        'isSame',
        'isSingleVersion',
        'isStable',
        'isValid',
        'isVersion',
        'matches',
        'sortVersions',
      ]);
    });

    it('equals', () => {
      expect(api.equals('1.2.3', '1.2.3')).toBeTrue();
      expect(api.equals('1.2.3', '3.2.1')).toBeFalse();
    });

    it('getMajor', () => {
      expect(api.getMajor('4.5.6')).toBe(4);
      expect(api.getMajor('invalid')).toBeNull();
    });

    it('getMinor', () => {
      expect(api.getMinor('4.5.6')).toBe(5);
      expect(api.getMinor('invalid')).toBeNull();
    });

    it('getPatch', () => {
      expect(api.getPatch('4.5.6')).toBe(6);
      expect(api.getPatch('invalid')).toBeNull();
    });

    it('getNewValue', () => {
      expect(
        api.getNewValue({
          currentValue: '1.2.3',
          rangeStrategy: 'auto',
          currentVersion: '1.2.3',
          newVersion: '3.2.1',
        }),
      ).toBe('3.2.1');

      expect(
        api.getNewValue({
          currentValue: '1.2.3',
          rangeStrategy: 'auto',
          currentVersion: 'v1.2.3',
          newVersion: 'v3.2.1',
        }),
      ).toBe('3.2.1');

      expect(api.getNewValue(partial<NewValueConfig>({}))).toBeNull();
    });

    it('isCompatible', () => {
      expect(api.isCompatible('1.2.3', '')).toBe(true);
    });

    it('isGreaterThan', () => {
      expect(api.isGreaterThan('1.2.3', '3.2.1')).toBe(false);
      expect(api.isGreaterThan('3.2.1', '1.2.3')).toBe(true);
      expect(api.isGreaterThan('1.2.3-a10', '1.2.3-a1')).toBe(true);
    });

    it('isSingleVersion', () => {
      expect(api.isSingleVersion('1.2.3')).toBe(true);
    });

    it('isStable', () => {
      expect(api.isStable('1.2.3')).toBe(true);
    });

    it('isValid', () => {
      expect(api.isValid('1.2.3')).toBe(true);
      expect(api.isValid('1.2.3-a1')).toBe(true);
      expect(api.isValid('invalid')).toBe(false);
    });

    it('isVersion', () => {
      expect(api.isVersion('1.2.3')).toBe(true);
      expect(api.isVersion('invalid')).toBe(false);
    });

    it('matches', () => {
      expect(api.matches('1.2.3', '1.2.3')).toBe(true);
      expect(api.matches('1.2.3', '3.2.1')).toBe(false);
    });

    it('sortVersions', () => {
      expect(api.sortVersions('1.2.3', '1.2.3')).toBe(0);
      expect(api.sortVersions('1.2.3', '3.2.1')).toBe(-2);
      expect(api.sortVersions('3.2.1', '1.2.3')).toBe(2);
    });

    it('isLessThanRange', () => {
      expect(api.isLessThanRange('1.2.3', '3.2.1')).toBeTrue();
      expect(api.isLessThanRange('3.2.1', '1.2.3')).toBeFalse();
    });

    it('minSatisfyingVersion', () => {
      expect(api.minSatisfyingVersion(['1.2.3'], '1.2.3')).toBe('1.2.3');
      expect(
        api.minSatisfyingVersion(['1.1.1', '2.2.2', '3.3.3'], '2.2.2'),
      ).toBe('2.2.2');
      expect(
        api.minSatisfyingVersion(['1.1.1', '2.2.2', '3.3.3'], '1.2.3'),
      ).toBeNull();
    });

    it('getSatisfyingVersion', () => {
      expect(api.getSatisfyingVersion(['1.2.3'], '1.2.3')).toBe('1.2.3');
      expect(
        api.getSatisfyingVersion(['1.1.1', '2.2.2', '3.3.3'], '2.2.2'),
      ).toBe('2.2.2');
      expect(
        api.getSatisfyingVersion(['1.1.1', '2.2.2', '3.3.3'], '1.2.3'),
      ).toBeNull();
    });

    it('isSame', () => {
      expect(api.isSame('major', '4.5.6', '4.6.0')).toBe(true);
      expect(api.isSame('major', '4.5.6', '5.0.0')).toBe(false);
      expect(api.isSame('minor', '4.5.6', '5.5.0')).toBe(true);
      expect(api.isSame('minor', '4.5.6', '4.6.0')).toBe(false);
      expect(api.isSame('patch', '4.5.6', '5.5.6')).toBe(true);
      expect(api.isSame('patch', '4.5.6', '4.6.0')).toBe(false);
    });
  });
});
