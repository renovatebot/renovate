const githubApp = require('../../lib/config/github-app');
const ghApi = require('../../lib/platform/github');
const fs = require('fs');
const path = require('path');

jest.mock('../../lib/platform/github');

const examplePrivateKey = fs.readFileSync(
  path.resolve(__dirname, '../_fixtures/jwt/example.pem')
);

describe('config/github-app', () => {
  describe('generateJwt', () => {
    it('returns a jwt for valid PEM file', () => {
      expect(githubApp.generateJwt(1, examplePrivateKey)).not.toBeNull();
    });
  });
  describe('getUserRepositories', async () => {
    beforeEach(() => {
      ghApi.getInstallationToken = jest.fn(() => 'some_token');
    });
    it('returns empty list', async () => {
      ghApi.getInstallationRepositories = jest.fn(() => ({ repositories: [] }));
      expect(await githubApp.getUserRepositories('token', 123)).toHaveLength(0);
    });
    it('returns a repository list', async () => {
      ghApi.getInstallationRepositories = jest.fn(() => ({
        repositories: [{ full_name: 'a' }, { full_name: 'b' }],
      }));
      expect(
        await githubApp.getUserRepositories('token', 123)
      ).toMatchSnapshot();
    });
  });
  describe('getRepositories', async () => {
    const config = {
      githubAppId: 123,
      githubAppKey: 'some_key',
      repositories: [],
    };
    beforeEach(() => {
      githubApp.generateJwt = jest.fn();
      githubApp.generateJwt.mockImplementationOnce(() => 'jwt');
      githubApp.getUserRepositories = jest.fn();
    });
    it('returns empty list if error', async () => {
      ghApi.getInstallations.mockImplementationOnce(() => {
        throw new Error('error');
      });
      const results = await githubApp.getRepositories(config);
      expect(results).toHaveLength(0);
    });
    it('returns empty list if no installations', async () => {
      ghApi.getInstallations.mockImplementationOnce(() => []);
      const results = await githubApp.getRepositories(config);
      expect(results).toHaveLength(0);
    });
    it('returns empty list if no repos per installation', async () => {
      ghApi.getInstallations.mockImplementationOnce(() => [{ id: 567 }]);
      githubApp.getUserRepositories.mockImplementationOnce(() => []);
      const results = await githubApp.getRepositories(config);
      expect(results).toHaveLength(0);
    });
    it('returns list of repos', async () => {
      ghApi.getInstallations.mockImplementationOnce(() => [
        { id: 567 },
        { id: 568 },
      ]);
      githubApp.getUserRepositories.mockImplementationOnce(() => [
        {
          repository: 'a/b',
          token: 'token_a',
        },
        {
          repository: 'a/c',
          token: 'token_a',
        },
      ]);
      githubApp.getUserRepositories.mockImplementationOnce(() => [
        {
          repository: 'd/e',
          token: 'token_d',
        },
        {
          repository: 'd/f',
          token: 'token_d',
        },
      ]);
      const results = await githubApp.getRepositories(config);
      expect(results).toMatchSnapshot();
    });
    it('returns filtered list of repos', async () => {
      ghApi.getInstallations.mockImplementationOnce(() => [
        { id: 567 },
        { id: 568 },
      ]);
      githubApp.getUserRepositories.mockImplementationOnce(() => [
        {
          repository: 'a/b',
          token: 'token_a',
        },
        {
          repository: 'a/c',
          token: 'token_a',
        },
      ]);
      githubApp.getUserRepositories.mockImplementationOnce(() => [
        {
          repository: 'd/e',
          token: 'token_d',
        },
        {
          repository: 'd/f',
          token: 'token_d',
        },
      ]);
      config.repositories = ['a/b', 'd/f', 'x/y'];
      const results = await githubApp.getRepositories(config);
      expect(results.length).toBe(2);
      expect(results).toMatchSnapshot();
    });
  });
});
