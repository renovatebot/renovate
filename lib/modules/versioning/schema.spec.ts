import api from './api';
import { Versioning } from './schema';

describe('modules/versioning/schema', () => {
  it('parses valid version strings', () => {
    const versioning = Versioning.parse('semver');
    expect(versioning).toBeDefined();
    expect(versioning).toEqual(api.get('semver'));
  });

  it('throws an error for invalid version strings', () => {
    expect(() => Versioning.parse('foobar')).toThrow();
  });
});
