describe('platform/github/storage', () => {
  const GithubStorage = require('../../../lib/platform/github/storage');
  const GitStorage = require('../../../lib/platform/git/storage');

  function getAllPropertyNames(obj) {
    let props = [];
    let obj2 = obj;

    while (obj2 != null) {
      props = props.concat(Object.getOwnPropertyNames(obj2));
      obj2 = Object.getPrototypeOf(obj2);
    }

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
