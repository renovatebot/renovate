describe('platform/github/storage', () => {
  const GithubStorage = require('../../../lib/platform/github/storage');
  const GitStorage = require('../../../lib/platform/git/storage');

  function getAllPropertyNames(obj) {
    var props = [];

    do {
      props = props.concat(Object.getOwnPropertyNames(obj));
    } while ((obj = Object.getPrototypeOf(obj)));

    return props.filter(p => !p.startsWith('_'));
  }
  it('has same API for git storage', () => {
    const githubMethods = getAllPropertyNames(new GithubStorage()).sort();
    const gitMethods = getAllPropertyNames(new GitStorage()).sort();
    expect(githubMethods).toMatchObject(gitMethods);
  });
  it('getRepoStatus exists', async () => {
    expect((await new GithubStorage()).getRepoStatus()).toEqual({});
  });
});
