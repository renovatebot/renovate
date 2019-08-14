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
    const optionalFunctions = ['isLessThanRange', 'valueToVersion'];
    const npmApi = Object.keys(versioning.get('semver'))
      .filter(val => !optionalFunctions.includes(val))
      .sort();
    for (const supportedScheme of supportedSchemes.filter(s => s !== 'regex')) {
      it(supportedScheme, () => {
        const schemeKeys = Object.keys(versioning.get(supportedScheme))
          .filter(val => !optionalFunctions.includes(val))
          .sort();
        expect(schemeKeys).toEqual(npmApi);
        expect(
          Object.keys(
            require('../../lib/versioning/' + supportedScheme).api
          ).sort()
        ).toEqual(Object.keys(versioning.get(supportedScheme)).sort());
      });
    }
  });
});
