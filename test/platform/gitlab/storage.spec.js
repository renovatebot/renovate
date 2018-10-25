describe('platform/gitlab/storage', () => {
  jest.mock('../../../lib/platform/gitlab/gl-got-wrapper');
  const GitlabStorage = require('../../../lib/platform/gitlab/storage');
  const GitStorage = require('../../../lib/platform/git/storage');
  const get = require('../../../lib/platform/gitlab/gl-got-wrapper');
  it('has same API for git storage', () => {
    const gitlabMethods = Object.keys(new GitlabStorage()).sort();
    const gitMethods = Object.keys(new GitStorage()).sort();
    expect(gitlabMethods).toMatchObject(gitMethods);
  });
  it('getRepoStatus exists', async () => {
    expect((await new GitlabStorage()).getRepoStatus()).toEqual({});
  });
  describe('createBranch()', () => {
    it('creates the branch', async () => {
      get.post.mockReturnValue({});
      const storage = new GitlabStorage();
      await storage.createBranch('renovate/some-branch', 'commit');
      expect(get.post.mock.calls).toMatchSnapshot();
    });
  });
});
