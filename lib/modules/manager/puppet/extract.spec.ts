import { EOL } from 'os';
import { Fixtures } from '../../../../test/fixtures';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge';
import { extractPackageFile } from '.';

describe('modules/manager/puppet/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty Puppetfile', () => {
      expect(extractPackageFile('')).toBeNull();
    });

    it('extracts multiple modules from Puppetfile without a forge', () => {
      const res = extractPackageFile(Fixtures.get('Puppetfile_no_forge'));

      expect(res.deps).toEqual([
        {
          datasource: PuppetForgeDatasource.id,
          depName: 'puppetlabs/stdlib',
          packageName: 'puppetlabs/stdlib',
          currentValue: '8.0.0',
        },
        {
          datasource: PuppetForgeDatasource.id,
          depName: 'puppetlabs/apache',
          packageName: 'puppetlabs/apache',
          currentValue: '6.5.1',
        },
        {
          datasource: PuppetForgeDatasource.id,
          depName: 'puppetlabs/puppetdb',
          packageName: 'puppetlabs/puppetdb',
          currentValue: '7.9.0',
        },
      ]);
    });

    it('extracts multiple modules from Puppetfile with multiple forges/registries', () => {
      const res = extractPackageFile(
        Fixtures.get('Puppetfile_multiple_forges')
      );

      expect(res.deps).toEqual([
        {
          datasource: PuppetForgeDatasource.id,
          depName: 'puppetlabs/stdlib',
          packageName: 'puppetlabs/stdlib',
          currentValue: '8.0.0',
          registryUrls: ['https://forgeapi.puppetlabs.com'],
        },
        {
          datasource: PuppetForgeDatasource.id,
          depName: 'puppetlabs/apache',
          packageName: 'puppetlabs/apache',
          currentValue: '6.5.1',
          registryUrls: ['https://forgeapi.puppetlabs.com'],
        },
        {
          datasource: PuppetForgeDatasource.id,
          depName: 'puppetlabs/puppetdb',
          packageName: 'puppetlabs/puppetdb',
          currentValue: '7.9.0',
          registryUrls: ['https://forgeapi.puppetlabs.com'],
        },
        {
          datasource: PuppetForgeDatasource.id,
          depName: 'mock/mockstdlib',
          packageName: 'mock/mockstdlib',
          currentValue: '10.0.0',
          registryUrls: ['https://some-other-puppet-forge.com'],
        },
        {
          datasource: PuppetForgeDatasource.id,
          depName: 'mock/mockapache',
          packageName: 'mock/mockapache',
          currentValue: '2.5.1',
          registryUrls: ['https://some-other-puppet-forge.com'],
        },
        {
          datasource: PuppetForgeDatasource.id,
          depName: 'mock/mockpuppetdb',
          packageName: 'mock/mockpuppetdb',
          currentValue: '1.9.0',
          registryUrls: ['https://some-other-puppet-forge.com'],
        },
      ]);
    });

    it('extracts multiple git tag modules from Puppetfile', () => {
      const res = extractPackageFile(Fixtures.get('Puppetfile_github_tag'));

      expect(res.deps).toEqual([
        {
          datasource: GithubTagsDatasource.id,
          depName: 'apache',
          packageName: 'puppetlabs/puppetlabs-apache',
          githubRepo: 'puppetlabs/puppetlabs-apache',
          currentValue: '0.9.0',
          sourceUrl: 'https://github.com/puppetlabs/puppetlabs-apache',
          gitRef: true,
        },
        {
          datasource: GithubTagsDatasource.id,
          depName: 'stdlib',
          packageName: 'puppetlabs/puppetlabs-stdlib',
          githubRepo: 'puppetlabs/puppetlabs-stdlib',
          currentValue: '5.0.0',
          sourceUrl: 'git@github.com:puppetlabs/puppetlabs-stdlib.git',
          gitRef: true,
        },
      ]);
    });

    it('Git module without a tag should result in a skip reason', () => {
      const res = extractPackageFile(
        [
          "mod 'stdlib',",
          "  :git => 'git@github.com:puppetlabs/puppetlabs-stdlib.git',",
        ].join(EOL)
      );

      expect(res.deps).toEqual([
        {
          depName: 'stdlib',
          gitRef: true,
          skipReason: 'invalid-version',
          sourceUrl: 'git@github.com:puppetlabs/puppetlabs-stdlib.git',
        },
      ]);
    });

    it('Skip reason should be overwritten by parser', () => {
      const res = extractPackageFile(
        [
          "mod 'stdlib', '0.1.0', 'i create a skip reason'",
          "  :git => 'git@github.com:puppetlabs/puppetlabs-stdlib.git',",
        ].join(EOL)
      );

      expect(res.deps).toEqual([
        {
          depName: 'stdlib',
          gitRef: true,
          skipReason: 'invalid-config',
          sourceUrl: 'git@github.com:puppetlabs/puppetlabs-stdlib.git',
        },
      ]);
    });

    it('GitTagsDatasource', () => {
      const res = extractPackageFile(Fixtures.get('Puppetfile_git_tag'));

      expect(res.deps).toEqual([
        {
          datasource: GitTagsDatasource.id,
          depName: 'apache',
          packageName: 'https://gitlab.com/example/project.git',
          repo: 'https://gitlab.com/example/project.git',
          sourceUrl: 'https://gitlab.com/example/project.git',
          githubRepo: undefined,
          gitRef: true,
          currentValue: '0.9.0',
        },
        {
          datasource: GitTagsDatasource.id,
          depName: 'stdlib',
          packageName: 'git@gitlab.com:example/project_stdlib.git',
          repo: 'git@gitlab.com:example/project_stdlib.git',
          githubRepo: undefined,
          sourceUrl: 'git@gitlab.com:example/project_stdlib.git',
          gitRef: true,
          currentValue: '5.0.0',
        },
        {
          datasource: GitTagsDatasource.id,
          depName: 'multiple_dirs_ssh',
          packageName: 'git@gitlab.com:dir1/dir2/project.git',
          repo: 'git@gitlab.com:dir1/dir2/project.git',
          githubRepo: undefined,
          sourceUrl: 'git@gitlab.com:dir1/dir2/project.git',
          gitRef: true,
          currentValue: '1.0.0',
        },
        {
          datasource: GitTagsDatasource.id,
          depName: 'multiple_dirs_https',
          packageName: 'https://gitlab.com/dir1/dir2/project.git',
          repo: 'https://gitlab.com/dir1/dir2/project.git',
          githubRepo: undefined,
          sourceUrl: 'https://gitlab.com/dir1/dir2/project.git',
          gitRef: true,
          currentValue: '1.9.0',
        },
        {
          depName: 'invalid_url',
          sourceUrl: 'hello world',
          gitRef: true,
          skipReason: 'invalid-url',
        },
      ]);
    });
  });
});
