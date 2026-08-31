import { getApiBaseUrl, getSourceUrlBase } from './url.ts';

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

    it('maps the GitHub.com API URL to its source URL', () => {
      expect(getSourceUrlBase('https://api.github.com')).toBe(
        'https://github.com/',
      );
    });

    it('maps a GHEC API URL to its source URL', () => {
      expect(getSourceUrlBase('https://api.octocorp.ghe.com')).toBe(
        'https://octocorp.ghe.com/',
      );
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

    it('maps a GHEC source URL to its API URL', () => {
      expect(getApiBaseUrl('https://octocorp.ghe.com/')).toBe(
        'https://api.octocorp.ghe.com/',
      );
    });

    it('preserves a GHEC API URL', () => {
      expect(getApiBaseUrl('https://api.octocorp.ghe.com/')).toBe(
        'https://api.octocorp.ghe.com/',
      );
    });

    it('preserves a legacy GHEC API URL', () => {
      expect(getApiBaseUrl('https://octocorp.ghe.com/api/v3/')).toBe(
        'https://octocorp.ghe.com/api/v3/',
      );
    });
  });
});
