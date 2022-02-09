import { GitHubReleaseMocker } from './test';
import { getApiBaseUrl, getGithubRelease, getSourceUrlBase } from '.';

describe('datasource/github-releases/common', () => {
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

  describe('getGithubRelease', () => {
    const apiUrl = 'https://github.com/';
    const lookupName = 'someDep';
    const releaseMock = new GitHubReleaseMocker(apiUrl, lookupName);

    it('returns release', async () => {
      const version = 'v1.0.0';
      releaseMock.release(version);

      const release = await getGithubRelease(apiUrl, lookupName, version);
      expect(release.tag_name).toBe(version);
    });
  });
});
