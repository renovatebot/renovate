import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/cloudbuild/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(Fixtures.get('cloudbuild.yml'));
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
    });
  });
});
