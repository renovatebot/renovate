import { getApiBaseUrl, getSourceUrlBase } from './common';

describe('modules/datasource/github-releases/common', () => {
  describe('getSourceUrlBase', () => {
    it('ensures trailing slash', () => {
      const sourceUrl = getSourceUrlBase('https://gh.my-company.com');
      expect(sourceUrl).toBe('https://gh.my-company.com/');
    });

    it('defaults to github.com', () => {
      const sourceUrl = getSourceUrlBase(null);
      expect(sourceUrl).toBe('https://github.com/');
    });
  });

  describe('getApiBaseUrl', () => {
    it('maps to api.github.com', () => {
      const apiUrl = getApiBaseUrl('https://github.com/');
      expect(apiUrl).toBe('https://api.github.com/');
    });

    it('supports local github installations', () => {
      const apiUrl = getApiBaseUrl('https://gh.my-company.com/');
      expect(apiUrl).toBe('https://gh.my-company.com/api/v3/');
    });
  });
});
