const github = require('../../lib/platform/github');
const gitlab = require('../../lib/platform/gitlab');
const azure = require('../../lib/platform/azure');
const bitbucket = require('../../lib/platform/bitbucket');

describe('platform', () => {
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
});
