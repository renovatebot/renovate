import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('modules/manager/puppet/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty Puppetfile', () => {
      expect(extractPackageFile('')).toBeNull();
    });

    it('extracts multiple modules from Puppetfile', () => {
      const res = extractPackageFile(Fixtures.get('Puppetfile'));
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });

  });
});
