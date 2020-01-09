import * as versioning from '../../lib/versioning';
import { getOptions } from '../../lib/config/definitions';
import {
  GenericVersioningApi,
  GenericVersion,
} from '../../lib/versioning/loose/generic';

const supportedSchemes = getOptions().find(
  option => option.name === 'versionScheme'
).allowedValues;

describe('versioning.get(versionScheme)', () => {
  it('has api', () => {
    expect(Object.keys(versioning.get('semver')).sort()).toMatchSnapshot();
  });

  it('should fallback to semver', () => {
    expect(versioning.get(undefined)).toBe(versioning.get('semver'));
    expect(versioning.get('unknown')).toBe(versioning.get('semver'));
  });

  it('should accept config', () => {
    expect(versioning.get('semver:test')).toBeDefined();
  });

  describe('should return the same interface', () => {
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
    const npmApi = Object.keys(versioning.get('semver'))
      .filter(val => !optionalFunctions.includes(val))
      .sort();

    function getAllPropertyNames(obj: any): string[] {
      const props = [];
      let o = obj;

      do {
        Object.getOwnPropertyNames(o).forEach(prop => {
          if (props.indexOf(prop) === -1) {
            props.push(prop);
          }
        });
        // eslint-disable-next-line no-cond-assign
      } while ((o = Object.getPrototypeOf(o)));

      return props;
    }

    for (const supportedScheme of supportedSchemes) {
      it(supportedScheme, () => {
        const schemeKeys = getAllPropertyNames(versioning.get(supportedScheme))
          .filter(
            val => !optionalFunctions.includes(val) && !val.startsWith('_')
          )
          .sort();

        expect(schemeKeys).toEqual(npmApi);

        const apiOrCtor = require('../../lib/versioning/' + supportedScheme)
          .api;
        if (versioning.isVersioningApiConstructor(apiOrCtor)) return;

        expect(Object.keys(apiOrCtor).sort()).toEqual(
          Object.keys(versioning.get(supportedScheme)).sort()
        );
      });
    }

    it('dummy', () => {
      class DummyScheme extends GenericVersioningApi {
        // eslint-disable-next-line class-methods-use-this
        protected _compare(_version: string, _other: string): number {
          throw new Error('Method not implemented.');
        }

        // eslint-disable-next-line class-methods-use-this
        protected _parse(_version: string): GenericVersion {
          throw new Error('Method not implemented.');
        }
      }

      const api = new DummyScheme();
      const schemeKeys = getAllPropertyNames(api)
        .filter(val => !optionalFunctions.includes(val) && !val.startsWith('_'))
        .sort();

      expect(schemeKeys).toEqual(npmApi);
    });
  });
});
