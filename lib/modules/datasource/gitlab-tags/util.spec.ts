import { getDepHost, getSourceUrl } from './util';

describe('modules/datasource/gitlab-tags/util', () => {
  describe('getDepHost', () => {
    it('works', () => {
      expect(getDepHost()).toBe('https://gitlab.com');
      expect(getDepHost('https://gitlab.domain.test/api/v4')).toBe(
        'https://gitlab.domain.test',
      );
      expect(getDepHost('https://domain.test/gitlab/api/v4')).toBe(
        'https://domain.test/gitlab',
      );
    });
  });

  describe('getSourceUrl', () => {
    it('works', () => {
      expect(getSourceUrl('some/repo')).toBe('https://gitlab.com/some/repo');
      expect(
        getSourceUrl('some/repo', 'https://gitlab.domain.test/api/v4'),
      ).toBe('https://gitlab.domain.test/some/repo');
    });
  });
});
