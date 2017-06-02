const githubAppHelper = require('../../lib/helpers/github-app');
const ghApi = require('../../lib/api/github');
const fs = require('fs');
const path = require('path');

jest.mock('../../lib/api/github');

const examplePrivateKey = fs.readFileSync(
  path.resolve(__dirname, '../_fixtures/jwt/example.pem')
);

describe('helpers/github-app', () => {
  describe('generateJwt', () => {
    it('returns a jwt for valid PEM file', () => {
      expect(githubAppHelper.generateJwt(1, examplePrivateKey)).not.toBeNull();
    });
  });
  describe('getUserRepositories', async () => {
    beforeEach(() => {
      ghApi.getInstallationToken = jest.fn(() => 'some_token');
    });
    it('returns empty list', async () => {
      ghApi.getInstallationRepositories = jest.fn(() => ({ repositories: [] }));
      expect(
        await githubAppHelper.getUserRepositories('token', 123)
      ).toHaveLength(0);
    });
    it('returns a repository list', async () => {
      ghApi.getInstallationRepositories = jest.fn(() => ({
        repositories: [{ full_name: 'a' }, { full_name: 'b' }],
      }));
      expect(
        await githubAppHelper.getUserRepositories('token', 123)
      ).toMatchSnapshot();
    });
  });
  describe('getRepositories', async () => {
    const config = {
      githubAppId: 123,
      githubAppKey: 'some_key',
    };
    beforeEach(() => {
      githubAppHelper.generateJwt = jest.fn();
      githubAppHelper.generateJwt.mockImplementationOnce(() => 'jwt');
      githubAppHelper.getUserRepositories = jest.fn();
    });
    it('returns empty list if error', async () => {
      ghApi.getInstallations.mockImplementationOnce(() => {
        throw new Error('error');
      });
      const results = await githubAppHelper.getRepositories(config);
      expect(results).toHaveLength(0);
    });
    it('returns empty list if no installations', async () => {
      ghApi.getInstallations.mockImplementationOnce(() => []);
      const results = await githubAppHelper.getRepositories(config);
      expect(results).toHaveLength(0);
    });
    it('returns empty list if no repos per installation', async () => {
      ghApi.getInstallations.mockImplementationOnce(() => [{ id: 567 }]);
      githubAppHelper.getUserRepositories.mockImplementationOnce(() => []);
      const results = await githubAppHelper.getRepositories(config);
      expect(results).toHaveLength(0);
    });
    it('returns list of repos', async () => {
      ghApi.getInstallations.mockImplementationOnce(() => [
        { id: 567 },
        { id: 568 },
      ]);
      githubAppHelper.getUserRepositories.mockImplementationOnce(() => [
        {
          repository: 'a/b',
          token: 'token_a',
        },
        {
          repository: 'a/c',
          token: 'token_a',
        },
      ]);
      githubAppHelper.getUserRepositories.mockImplementationOnce(() => [
        {
          repository: 'd/e',
          token: 'token_d',
        },
        {
          repository: 'd/f',
          token: 'token_d',
        },
      ]);
      const results = await githubAppHelper.getRepositories(config);
      expect(results).toMatchSnapshot();
    });
  });
});
