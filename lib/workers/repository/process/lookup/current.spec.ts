import * as allVersioning from '../../../../modules/versioning/index.ts';
import { getCurrentVersion } from './current.ts';

const versioning = allVersioning.get('semver');

describe('workers/repository/process/lookup/current', () => {
  describe('getCurrentVersion()', () => {
    it('returns null if the current value is not a string', () => {
      expect(
        getCurrentVersion(
          // the config is not always well-formed, so this is guarded at runtime
          null as unknown as string,
          '1.0.0',
          versioning,
          'replace',
          '1.1.0',
          ['1.0.0', '1.1.0'],
        ),
      ).toBeNull();
    });
  });
});
