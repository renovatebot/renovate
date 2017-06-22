const bunyan = require('bunyan');

const logger = bunyan.createLogger({
  name: 'test',
  stream: process.stdout,
  level: 'fatal',
});

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

  describe('getRepos', () => {
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

  async function initRepo(...args) {
    // projects/owned
    glGot.mockImplementationOnce();
    // projects/${config.repoName
    glGot.mockImplementationOnce(() => ({
      body: {
        default_branch: 'master',
      },
    }));
    // user
    glGot.mockImplementationOnce(() => ({
      body: {
        email: 'a@b.com',
      },
    }));
    return gitlab.initRepo(...args);
  }

  describe('initRepo', () => {
    [
      [undefined, ['mytoken'], 'mytoken', undefined],
      [
        undefined,
        ['mytoken', 'https://my.custom.endpoint/'],
        'mytoken',
        'https://my.custom.endpoint/',
      ],
      ['myenvtoken', [], 'myenvtoken', undefined],
    ].forEach(([envToken, args, token, endpoint], i) => {
      it(`should initialise the config for the repo - ${i}`, async () => {
        if (envToken !== undefined) {
          process.env.GITLAB_TOKEN = envToken;
        }
        const config = await initRepo('some/repo', ...args);
        expect(glGot.mock.calls).toMatchSnapshot();
        expect(config).toMatchSnapshot();
        expect(process.env.GITLAB_TOKEN).toBe(token);
        expect(process.env.GITLAB_ENDPOINT).toBe(endpoint);
      });
    });
    it('uses provided logger', async () => {
      const config = await initRepo(
        'some/repo',
        'some_token',
        'an_endpoint',
        logger
      );
      expect(config).toMatchSnapshot();
    });
    it('should throw an error if no token is provided', async () => {
      let err;
      try {
        await gitlab.initRepo('some/repo');
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe(
        'No token found for GitLab repository some/repo'
      );
    });
    it('should throw an error if receiving an error', async () => {
      glGot.mockImplementation(() => {
        throw new Error('always error');
      });
      let err;
      try {
        await gitlab.initRepo('some/repo', 'sometoken');
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('always error');
    });
    it('should use api v4', async () => {
      // projects/owned
      glGot.mockImplementationOnce(() => {
        throw new Error('any error');
      });
      // projects/${config.repoName
      glGot.mockImplementationOnce(() => ({
        body: {
          default_branch: 'master',
        },
      }));
      // user
      glGot.mockImplementationOnce(() => ({
        body: {
          email: 'a@b.com',
        },
      }));
      const config = await initRepo('some/repo', 'some_token');
      expect(config).toMatchSnapshot();
    });
  });
  describe('findFilePaths(fileName)', () => {
    it('should return the fileName', async () => {
      await initRepo('some/repo', 'token');
      const files = await gitlab.findFilePaths('package.json');
      expect(files).toEqual(['package.json']);
    });
  });
  describe('branchExists(branchName)', () => {
    it('should return true if 200 OK', async () => {
      glGot.mockImplementationOnce(() => ({ statusCode: 200 }));
      const branchExists = await gitlab.branchExists('foo');
      expect(branchExists).toBe(true);
    });
    it('should return false if not 200 OK', async () => {
      glGot.mockImplementationOnce(() => ({ statusCode: 500 }));
      const branchExists = await gitlab.branchExists('foo');
      expect(branchExists).toBe(false);
    });
    it('should return false if 404 error received', async () => {
      glGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      const branchExists = await gitlab.branchExists('foo');
      expect(branchExists).toBe(false);
    });
    it('should return error if non-404 error thrown', async () => {
      glGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 500,
        })
      );
      let e;
      try {
        await gitlab.branchExists('foo');
      } catch (err) {
        e = err;
      }
      expect(e.statusCode).toBe(500);
    });
  });
});
