import { getApiBaseUrl, getSourceUrlBase, parseSourceUrl } from './url.ts';

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

  describe('parseSourceUrl', () => {
    it.each`
      sourceUrl                                   | expected
      ${'https://github.com/owner/repo'}          | ${{ registryUrl: 'https://github.com/', packageName: 'owner/repo' }}
      ${'https://github.example.com/owner/repo/'} | ${{ registryUrl: 'https://github.example.com/', packageName: 'owner/repo' }}
      ${'https://github.com/owner'}               | ${null}
      ${'not a url'}                              | ${null}
    `('parses $sourceUrl', ({ sourceUrl, expected }) => {
      expect(parseSourceUrl(sourceUrl)).toEqual(expected);
    });
  });
});
