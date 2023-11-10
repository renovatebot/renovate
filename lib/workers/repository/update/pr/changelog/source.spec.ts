import { partial } from '../../../../../../test/util';
import type { BranchConfig } from '../../../../types';
import { GitHubChangeLogSource } from './github/source';

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
  });

  describe('hasValidRepository', () => {
    it('handles invalid repository', () => {
      expect(changelogSource.hasValidRepository('foo')).toBeFalse();
      expect(changelogSource.hasValidRepository('some/repo/name')).toBeFalse();
    });

    it('handles valid repository', () => {
      expect(changelogSource.hasValidRepository('some/repo')).toBeTrue();
    });
  });
});
