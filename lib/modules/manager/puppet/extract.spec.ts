import { Fixtures } from '../../../../test/fixtures';
import { GithubTagsDatasource } from '../../datasource/github-tags';
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
      const res = extractPackageFile(
        Fixtures.get('Puppetfile_multiple_forges')
      );
      expect(res.deps).toHaveLength(6);

      const forgeApiDeps = res.deps.filter((dep) =>
        dep.registryUrls.includes('https://forgeapi.puppetlabs.com')
      );
      const mockDeps = res.deps.filter((dep) =>
        dep.registryUrls.includes('https://some-other-puppet-forge.com')
      );

      expect(forgeApiDeps).toHaveLength(3);
      expect(mockDeps).toHaveLength(3);

      expect(res.deps).toMatchSnapshot();
    });

    it('extracts multiple git tag modules from Puppetfile', () => {
      const res = extractPackageFile(Fixtures.get('Puppetfile_git_tag'));
      expect(res.deps).toHaveLength(2);

      const dep1 = res.deps[0];
      expect(dep1.depName).toBe('apache');
      expect(dep1.packageName).toBe('puppetlabs/puppetlabs-apache');
      expect(dep1.githubRepo).toBe('puppetlabs/puppetlabs-apache');
      expect(dep1.sourceUrl).toBe(
        'https://github.com/puppetlabs/puppetlabs-apache'
      );
      expect(dep1.gitRef).toBe(true);
      expect(dep1.currentValue).toBe('0.9.0');
      expect(dep1.datasource).toBe(GithubTagsDatasource.id);

      const dep2 = res.deps[1];
      expect(dep2.depName).toBe('stdlib');
      expect(dep2.packageName).toBe('puppetlabs/puppetlabs-stdlib');
      expect(dep2.githubRepo).toBe('puppetlabs/puppetlabs-stdlib');
      expect(dep2.sourceUrl).toBe(
        'git@github.com:puppetlabs/puppetlabs-stdlib.git'
      );
      expect(dep2.gitRef).toBe(true);
      expect(dep2.currentValue).toBe('5.0.0');
      expect(dep2.datasource).toBe(GithubTagsDatasource.id);

      // commit -> dep.currentDigest = depRefPart;

      expect(res.deps).toMatchSnapshot();
    });
  });
});
