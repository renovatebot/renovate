import { getApiBaseUrl, getSourceUrlBase, isGithubHost } from './url.ts';

describe('util/github/url', () => {
  describe('getSourceUrlBase', () => {
    it('ensures trailing slash', () => {
      const sourceUrl = getSourceUrlBase('https://gh.my-company.com');
      expect(sourceUrl).toBe('https://gh.my-company.com/');
    });

    it('defaults to github.com', () => {
      const sourceUrl = getSourceUrlBase(undefined);
      expect(sourceUrl).toBe('https://github.com/');
    });
  });

  describe('isGithubHost', () => {
    it('returns true for undefined (defaults to github.com)', () => {
      expect(isGithubHost(undefined)).toBeTrue();
    });

    it('returns true for github.com', () => {
      expect(isGithubHost('https://github.com')).toBeTrue();
    });

    it('returns true for api.github.com', () => {
      expect(isGithubHost('https://api.github.com/')).toBeTrue();
    });

    it('returns true for GHE with explicit /api/v3/ path', () => {
      expect(isGithubHost('https://ghe.company.com/api/v3/')).toBeTrue();
    });

    it('returns true for GHE with github in hostname', () => {
      expect(isGithubHost('https://github.mycompany.com/')).toBeTrue();
    });

    it('returns false for non-GitHub host', () => {
      expect(isGithubHost('https://pypi.org/pypi/')).toBeFalse();
    });

    it('returns false for arbitrary non-GitHub host', () => {
      expect(isGithubHost('https://registry.npmjs.org/')).toBeFalse();
    });
  });

  describe('getApiBaseUrl', () => {
    it('maps to api.github.com', () => {
      const apiUrl = getApiBaseUrl('https://github.com/');
      expect(apiUrl).toBe('https://api.github.com/');
    });

    it('supports local github installations', () => {
      expect(getApiBaseUrl('https://gh.my-company.com/')).toBe(
        'https://gh.my-company.com/api/v3/',
      );
      expect(getApiBaseUrl('https://gh.my-company.com/api/v3/')).toBe(
        'https://gh.my-company.com/api/v3/',
      );
    });
  });
});
