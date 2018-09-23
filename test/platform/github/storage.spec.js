describe('platform/github/storage', () => {
  const GithubStorage = require('../../../lib/platform/github/storage');
  const GitStorage = require('../../../lib/platform/git/storage');
  it('has same API for git storage', () => {
    const githubMethods = Object.keys(new GithubStorage()).sort();
    const gitMethods = Object.keys(new GitStorage()).sort();
    expect(githubMethods).toMatchObject(gitMethods);
  });
  it('getRepoStatus exists', async () => {
    expect((await new GithubStorage()).getRepoStatus()).toEqual({});
  });
});
