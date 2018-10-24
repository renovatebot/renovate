describe('platform/gitlab/storage', () => {
  const GitlabStorage = require('../../../lib/platform/gitlab/storage');
  const GitStorage = require('../../../lib/platform/git/storage');
  it('has same API for git storage', () => {
    const gitlabMethods = Object.keys(new GitlabStorage()).sort();
    const gitMethods = Object.keys(new GitStorage()).sort();
    expect(gitlabMethods).toMatchObject(gitMethods);
  });
  it('getRepoStatus exists', async () => {
    expect((await new GitlabStorage()).getRepoStatus()).toEqual({});
  });
});
