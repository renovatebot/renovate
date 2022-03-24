import { Fixtures } from '../../../../test/fixtures';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';
import { extractPackageFile } from './extract';

describe('modules/manager/puppet/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty Puppetfile', () => {
      expect(extractPackageFile('')).toBeNull();
    });

    it('extracts multiple modules from Puppetfile without a forge', () => {
      const res = extractPackageFile(Fixtures.get('Puppetfile_no_forge'));
      expect(res.deps).toHaveLength(3);

      const dep0 = res.deps[0];
      expect(dep0.depName).toBe('puppetlabs/stdlib');
      expect(dep0.datasource).toBe(PuppetForgeDatasource.id);
      expect(dep0.currentValue).toBe('8.0.0');
      expect(dep0.registryUrls).toBeUndefined();

      const dep1 = res.deps[1];
      expect(dep1.depName).toBe('puppetlabs/apache');
      expect(dep1.datasource).toBe(PuppetForgeDatasource.id);
      expect(dep1.currentValue).toBe('6.5.1');
      expect(dep1.registryUrls).toBeUndefined();

      const dep2 = res.deps[2];
      expect(dep2.depName).toBe('puppetlabs/puppetdb');
      expect(dep2.datasource).toBe(PuppetForgeDatasource.id);
      expect(dep2.currentValue).toBe('7.9.0');
      expect(dep2.registryUrls).toBeUndefined();
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

      const dep0 = res.deps[0];
      expect(dep0.depName).toBe('puppetlabs/stdlib');
      expect(dep0.datasource).toBe(PuppetForgeDatasource.id);
      expect(dep0.currentValue).toBe('8.0.0');
      expect(dep0.registryUrls).toInclude('https://forgeapi.puppetlabs.com');

      const dep1 = res.deps[1];
      expect(dep1.depName).toBe('puppetlabs/apache');
      expect(dep1.datasource).toBe(PuppetForgeDatasource.id);
      expect(dep1.currentValue).toBe('6.5.1');
      expect(dep1.registryUrls).toInclude('https://forgeapi.puppetlabs.com');

      const dep2 = res.deps[2];
      expect(dep2.depName).toBe('puppetlabs/puppetdb');
      expect(dep2.datasource).toBe(PuppetForgeDatasource.id);
      expect(dep2.currentValue).toBe('7.9.0');
      expect(dep2.registryUrls).toInclude('https://forgeapi.puppetlabs.com');

      const dep3 = res.deps[3];
      expect(dep3.depName).toBe('mock/mockstdlib');
      expect(dep3.datasource).toBe(PuppetForgeDatasource.id);
      expect(dep3.currentValue).toBe('10.0.0');
      expect(dep3.registryUrls).toInclude(
        'https://some-other-puppet-forge.com'
      );

      const dep4 = res.deps[4];
      expect(dep4.depName).toBe('mock/mockapache');
      expect(dep4.datasource).toBe(PuppetForgeDatasource.id);
      expect(dep4.currentValue).toBe('2.5.1');
      expect(dep4.registryUrls).toInclude(
        'https://some-other-puppet-forge.com'
      );

      const dep5 = res.deps[5];
      expect(dep5.depName).toBe('mock/mockpuppetdb');
      expect(dep5.datasource).toBe(PuppetForgeDatasource.id);
      expect(dep5.currentValue).toBe('1.9.0');
      expect(dep5.registryUrls).toInclude(
        'https://some-other-puppet-forge.com'
      );
    });

    it('extracts multiple git tag modules from Puppetfile', () => {
      const res = extractPackageFile(Fixtures.get('Puppetfile_git_tag'));
      expect(res.deps).toHaveLength(2);

      const dep0 = res.deps[0];
      expect(dep0.depName).toBe('apache');
      expect(dep0.packageName).toBe('puppetlabs/puppetlabs-apache');
      expect(dep0.githubRepo).toBe('puppetlabs/puppetlabs-apache');
      expect(dep0.sourceUrl).toBe(
        'https://github.com/puppetlabs/puppetlabs-apache'
      );
      expect(dep0.gitRef).toBe(true);
      expect(dep0.currentValue).toBe('0.9.0');
      expect(dep0.datasource).toBe(GithubTagsDatasource.id);

      const dep1 = res.deps[1];
      expect(dep1.depName).toBe('stdlib');
      expect(dep1.packageName).toBe('puppetlabs/puppetlabs-stdlib');
      expect(dep1.githubRepo).toBe('puppetlabs/puppetlabs-stdlib');
      expect(dep1.sourceUrl).toBe(
        'git@github.com:puppetlabs/puppetlabs-stdlib.git'
      );
      expect(dep1.gitRef).toBe(true);
      expect(dep1.currentValue).toBe('5.0.0');
      expect(dep1.datasource).toBe(GithubTagsDatasource.id);
    });

    it('Git module without a tag should result in a skip reason', () => {
      const res = extractPackageFile(
        Fixtures.get('Puppetfile_git_without_tag')
      );
      expect(res.deps).toHaveLength(1);

      const dep0 = res.deps[0];
      expect(dep0.depName).toBe('stdlib');
      expect(dep0.packageName).toBeUndefined();
      expect(dep0.githubRepo).toBeUndefined();
      expect(dep0.sourceUrl).toBe(
        'git@github.com:puppetlabs/puppetlabs-stdlib.git'
      );
      expect(dep0.gitRef).toBe(true);
      expect(dep0.currentValue).toBeUndefined();
      expect(dep0.datasource).toBeUndefined();
      expect(dep0.skipReason).toBe('invalid-version');
    });

    it('Skip reason should be overwritten by parser', () => {
      const res = extractPackageFile(
        Fixtures.get('Puppetfile_git_without_tag_and_three_params')
      );
      expect(res.deps).toHaveLength(1);

      const dep0 = res.deps[0];
      expect(dep0.depName).toBe('stdlib');
      expect(dep0.packageName).toBeUndefined();
      expect(dep0.githubRepo).toBeUndefined();
      expect(dep0.sourceUrl).toBe(
        'git@github.com:puppetlabs/puppetlabs-stdlib.git'
      );
      expect(dep0.gitRef).toBe(true);
      expect(dep0.currentValue).toBeUndefined();
      expect(dep0.datasource).toBeUndefined();
      expect(dep0.skipReason).toBe('invalid-config');
    });
  });
});
