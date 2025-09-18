import type { BranchConfig } from '../../../../types';
import { AzureChangeLogSource } from './azure/source';
import { GitHubChangeLogSource } from './github/source';
import { partial } from '~test/util';

const changelogSource = new GitHubChangeLogSource();
const upgrade = partial<BranchConfig>({
  endpoint: 'https://api.github.com/',
  packageName: 'renovate',
  sourceUrl: 'https://github.com/renovatebot/renovate',
});

describe('workers/repository/update/pr/changelog/source', () => {
  describe('getBaseUrl', () => {
    it('handles unsupported sourceUrl', () => {
      expect(
        changelogSource.getBaseUrl({
          ...upgrade,
          sourceUrl: undefined,
        }),
      ).toBeEmptyString();
    });

    it('handles sourceUrl', () => {
      expect(changelogSource.getBaseUrl(upgrade)).toBe('https://github.com/');
    });
  });

  describe('getRepositoryFromUrl', () => {
    it('handles unsupported sourceUrl', () => {
      expect(
        changelogSource.getRepositoryFromUrl({
          ...upgrade,
          sourceUrl: undefined,
        }),
      ).toBeEmptyString();
    });

    it('handles sourceUrl', () => {
      expect(changelogSource.getRepositoryFromUrl(upgrade)).toBe(
        'renovatebot/renovate',
      );
    });

    it('handles azure sourceUrl', () => {
      expect(
        changelogSource.getRepositoryFromUrl({
          ...upgrade,
          sourceUrl:
            'https://dev.azure.com/some-org/some-project/_git/some-repo',
        }),
      ).toBe('some-org/some-project/_git/some-repo');
    });
  });

  describe('hasValidRepository', () => {
    it('handles invalid repository', () => {
      expect(changelogSource.hasValidRepository('foo')).toBeFalse();
      expect(changelogSource.hasValidRepository('some/repo/name')).toBeFalse();
    });

    it('handles valid repository', () => {
      expect(changelogSource.hasValidRepository('some/repo')).toBeTrue();
    });

    it('handles valid repository for azure', () => {
      const azureSource = new AzureChangeLogSource();
      expect(azureSource.hasValidRepository('some-repo')).toBeTrue();
    });
  });
});
