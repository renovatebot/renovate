import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('modules/manager/puppet/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty Puppetfile', () => {
      expect(extractPackageFile('')).toBeNull();
    });

    it('extracts multiple modules from Puppetfile without a forge', () => {
      const res = extractPackageFile(Fixtures.get('Puppetfile_no_forge'));
      expect(res.deps).toHaveLength(3);
      expect(res.deps).toMatchSnapshot();
    });

    it('extracts multiple modules from Puppetfile with multiple forges/registries', () => {
      const res = extractPackageFile(Fixtures.get('Puppetfile_multiple_forges'));
      expect(res.deps).toHaveLength(6);

      const forgeApiDeps = res.deps.filter(dep => dep.registryUrls.includes('https://forgeapi.puppetlabs.com'));
      const mockDeps = res.deps.filter(dep => dep.registryUrls.includes('https://some-other-puppet-forge.com'));

      expect(forgeApiDeps).toHaveLength(3);
      expect(mockDeps).toHaveLength(3);

      expect(res.deps).toMatchSnapshot();
    });

  });
});
