describe('api/gitlab', () => {
  let gitlab;
  let glGot;
  beforeEach(() => {
    // clean up env
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_ENDPOINT;

    // reset module
    jest.resetModules();
    jest.mock('gl-got');
    gitlab = require('../../lib/api/gitlab');
    glGot = require('gl-got');
  });

  async function getRepos(...args) {
    // repo info
    glGot.mockImplementationOnce(() => ({
      body: [
        {
          path_with_namespace: 'a/b',
        },
        {
          path_with_namespace: 'c/d',
        },
      ],
    }));
    return gitlab.getRepos(...args);
  }

  describe('getRepos', () => {
    it('should throw an error if no token is provided', async () => {
      let err;
      try {
        await gitlab.getRepos();
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('No token found for getRepos');
    });
    it('should throw an error if it receives an error', async () => {
      glGot.mockImplementation(() => {
        throw new Error('getRepos error');
      });
      let err;
      try {
        await gitlab.getRepos('sometoken');
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('getRepos error');
    });
    it('should return an array of repos', async () => {
      const repos = await getRepos('sometoken');
      expect(glGot.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
    it('should support a custom endpoint', async () => {
      const repos = await getRepos('sometoken', 'someendpoint');
      expect(glGot.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });
});
