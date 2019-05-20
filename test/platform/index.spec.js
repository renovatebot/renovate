const github = require('../../lib/platform/github');
const gitlab = require('../../lib/platform/gitlab');
const azure = require('../../lib/platform/azure');
const bitbucket = require('../../lib/platform/bitbucket');
const bitbucketServer = require('../../lib/platform/bitbucket-server');

const platform = require('../../lib/platform');

describe('platform', () => {
  it('throws if wrong platform', async () => {
    const config = { platform: 'wrong', username: 'abc', password: '123' };
    await expect(platform.initPlatform(config)).rejects.toThrow();
  });
  it('initializes', async () => {
    const config = { platform: 'bitbucket', username: 'abc', password: '123' };
    expect(await platform.initPlatform(config)).toMatchSnapshot();
  });
  it('has a list of supported methods for github', () => {
    const githubMethods = Object.keys(github);
    expect(githubMethods).toMatchSnapshot();
  });

  it('has a list of supported methods for gitlab', () => {
    const gitlabMethods = Object.keys(gitlab);
    expect(gitlabMethods).toMatchSnapshot();
  });

  it('has a list of supported methods for azure', () => {
    const azureMethods = Object.keys(azure);
    expect(azureMethods).toMatchSnapshot();
  });

  it('has same API for github and gitlab', () => {
    const githubMethods = Object.keys(github);
    const gitlabMethods = Object.keys(gitlab);
    expect(githubMethods).toMatchObject(gitlabMethods);
  });

  it('has same API for github and azure', () => {
    const githubMethods = Object.keys(github);
    const azureMethods = Object.keys(azure);
    expect(githubMethods).toMatchObject(azureMethods);
  });

  it('has same API for github and Bitbucket', () => {
    const githubMethods = Object.keys(github);
    const bitbucketMethods = Object.keys(bitbucket);
    expect(bitbucketMethods).toMatchObject(githubMethods);
  });

  it('has same API for github and Bitbucket Server', () => {
    const githubMethods = Object.keys(github);
    const bitbucketMethods = Object.keys(bitbucketServer);
    expect(bitbucketMethods).toMatchObject(githubMethods);
  });
});
