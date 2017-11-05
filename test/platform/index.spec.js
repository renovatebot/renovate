const github = require('../../lib/platform/github');
const gitlab = require('../../lib/platform/gitlab');

describe('platform', () => {
  it('has same API for github and gitlab', () => {
    const githubMethods = Object.keys(github);
    const gitlabMethods = Object.keys(gitlab);
    expect(githubMethods).toMatchSnapshot();
    expect(gitlabMethods).toMatchSnapshot();
    expect(githubMethods).toMatchObject(gitlabMethods);
  });
});
