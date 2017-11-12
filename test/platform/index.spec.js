const github = require('../../lib/platform/github');
const gitlab = require('../../lib/platform/gitlab');
const vsts = require('../../lib/platform/vsts');

describe('platform', () => {
  it('has a list of supported methods for github', () => {
    const githubMethods = Object.keys(github);
    expect(githubMethods).toMatchSnapshot();
  });

  it('has a list of supported methods for gitlab', () => {
    const gitlabMethods = Object.keys(gitlab);
    expect(gitlabMethods).toMatchSnapshot();
  });

  it('has a list of supported methods for vsts', () => {
    const vstsMethods = Object.keys(vsts);
    expect(vstsMethods).toMatchSnapshot();
  });

  it('has same API for github and gitlab', () => {
    const githubMethods = Object.keys(github);
    const gitlabMethods = Object.keys(gitlab);
    expect(githubMethods).toMatchObject(gitlabMethods);
  });

  it('has same API for github and vsts', () => {
    const githubMethods = Object.keys(github);
    const vstsMethods = Object.keys(vsts);
    expect(githubMethods).toMatchObject(vstsMethods);
  });
});
