import {
  GenericVersioningApi,
  GenericVersion,
} from '../../../lib/versioning/loose/generic';

describe('loose/utils', () => {
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
    const props = [];
    let o = obj;

    // eslint-disable-next-line no-cond-assign
    do {
      Object.getOwnPropertyNames(o).forEach(prop => {
        if (props.indexOf(prop) === -1) {
          props.push(prop);
        }
      });
    } while ((o = Object.getPrototypeOf(o)));

    return props;
  }

  describe('GenericVersioningApi', () => {
    class DummyScheme extends GenericVersioningApi {
      // eslint-disable-next-line class-methods-use-this
      protected _compare(_version: string, _other: string): number {
        return _version ? _version.localeCompare(_other) : 0;
      }

      // eslint-disable-next-line class-methods-use-this
      protected _parse(_version: string): GenericVersion {
        return _version === 'test' ? null : { release: [1, 0, 0] };
      }
    }

    const api = new DummyScheme();
    const schemeKeys = getAllPropertyNames(api)
      .filter(val => !optionalFunctions.includes(val) && !val.startsWith('_'))
      .filter(
        val => !['minSatisfyingVersion', 'maxSatisfyingVersion'].includes(val)
      )
      .sort();

    for (const key of schemeKeys) {
      it(`${key}`, () => {
        expect(api[key]()).toMatchSnapshot();
      });
    }

    it('getMajor is null', () => {
      expect(api.getMajor('test')).toBeNull();
    });

    it('isLessThanRange', () => {
      expect(api.isLessThanRange('', '')).toBeFalsy();
    });
    it('minSatisfyingVersion', () => {
      expect(api.minSatisfyingVersion([''], '')).toBeNull();
    });
    it('maxSatisfyingVersion', () => {
      expect(api.maxSatisfyingVersion([''], '')).toBeNull();
    });
  });
});
