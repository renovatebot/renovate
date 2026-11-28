import {
  getApiBaseUrl,
  getApiBaseUrlFromRequestUrl,
  getSourceUrlBase,
} from './url.ts';

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

  describe('getApiBaseUrlFromRequestUrl', () => {
    it.each`
      url                                                 | expected
      ${'https://api.github.com/repos/foo/bar'}           | ${'https://api.github.com/'}
      ${'https://gh.my-company.com/api/v3/repos/foo/bar'} | ${'https://gh.my-company.com/api/v3/'}
      ${'https://gh.my-company.com/api/graphql'}          | ${'https://gh.my-company.com/api/v3/'}
      ${'https://api.my-company.ghe.com/repos/foo/bar'}   | ${'https://api.my-company.ghe.com/'}
    `('returns $expected for $url', ({ url, expected }) => {
      expect(getApiBaseUrlFromRequestUrl(url)).toBe(expected);
    });

    it('resolves relative URLs against the base URL', () => {
      expect(
        getApiBaseUrlFromRequestUrl(
          'repos/foo/bar',
          'https://gh.my-company.com/api/v3/',
        ),
      ).toBe('https://gh.my-company.com/api/v3/');
    });
  });
});
