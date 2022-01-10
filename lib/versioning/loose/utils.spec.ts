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

    type ApiTestExpected = number | boolean | undefined;
    type ApiTestData = {
      fn: keyof DummyScheme;
      expected: ApiTestExpected;
    };
    test.each`
      fn                   | expected
      ${'equals'}          | ${true}
      ${'getMajor'}        | ${1}
      ${'getMinor'}        | ${0}
      ${'getNewValue'}     | ${undefined}
      ${'getPatch'}        | ${0}
      ${'isCompatible'}    | ${true}
      ${'isGreaterThan'}   | ${false}
      ${'isSingleVersion'} | ${true}
      ${'isStable'}        | ${true}
      ${'isValid'}         | ${true}
      ${'isVersion'}       | ${true}
      ${'matches'}         | ${true}
      ${'sortVersions'}    | ${0}
    `('$fn', ({ fn, expected }: ApiTestData) => {
      const apiFn: () => ApiTestExpected = api[fn] as never;
      expect(apiFn()).toBe(expected);
    });

    it('getMajor is null', () => {
      expect(api.getMajor('test')).toBeNull();
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
