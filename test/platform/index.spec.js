const github = require('../../lib/platform/github');
const gitlab = require('../../lib/platform/gitlab');
const vsts = require('../../lib/platform/vsts');

describe('platform', () => {
  it('has same API for github and gitlab', () => {
    const githubMethods = Object.keys(github);
    const gitlabMethods = Object.keys(gitlab);
    const vstsMethods = Object.keys(vsts);
    expect(githubMethods).toMatchSnapshot();
    expect(gitlabMethods).toMatchSnapshot();
    expect(githubMethods).toMatchObject(gitlabMethods);
    expect(githubMethods).toMatchObject(vstsMethods);
  });
});
