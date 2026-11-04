import { getApiBaseUrl, getDepHost, getSourceUrl } from './url.ts';

describe('util/gitlab/url', () => {
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

  describe('getApiBaseUrl', () => {
    it('works', () => {
      expect(getApiBaseUrl()).toBe('https://gitlab.com/api/v4');
      expect(getApiBaseUrl('https://gitlab.domain.test')).toBe(
        'https://gitlab.domain.test/api/v4',
      );
      expect(getApiBaseUrl('https://gitlab.domain.test/api/v4')).toBe(
        'https://gitlab.domain.test/api/v4',
      );
      expect(getApiBaseUrl('https://domain.test/gitlab')).toBe(
        'https://domain.test/gitlab/api/v4',
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
