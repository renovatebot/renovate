import * as versioning from '../../lib/versioning';
import { getOptions } from '../../lib/config/definitions';

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
  });
});
