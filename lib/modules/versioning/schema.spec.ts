import api from './api';
import { Versioning } from './schema';

describe('modules/versioning/schema', () => {
  it('returns existing version scheme', () => {
    const versioning1 = Versioning.parse('hermit');
    const versioning2 = Versioning.parse('hermit:foobar');
    expect(versioning1.isValid).toBeFunction();
    expect(versioning2.isValid).toBeFunction();
    expect(versioning1).not.toBe(versioning2);
  });

  it('falls back to default version scheme', () => {
    const defaultVersioning = api.get('semver-coerced');
    expect(Versioning.parse('foobarbaz')).toBe(defaultVersioning);
    expect(Versioning.parse('')).toBe(defaultVersioning);
  });

  it('catches errors', () => {
    const res = Versioning.safeParse('regex:foobar');
    expect(res.success).toBeFalse();
  });
});
