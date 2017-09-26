const logger = require('../_fixtures/logger');

describe('api/github', () => {
  let github;
  let ghGot;
  beforeEach(() => {
    // clean up env
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_ENDPOINT;

    // reset module
    jest.resetModules();
    jest.mock('gh-got');
    github = require('../../lib/api/github');
    ghGot = require('gh-got');
  });

  describe('getInstallations', () => {
    it('should return an array of installations', async () => {
      ghGot.mockImplementationOnce(() => ({
        body: ['a', 'b'],
      }));
      const installations = await github.getInstallations('sometoken');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(installations).toMatchSnapshot();
    });
    it('should return a 404', async () => {
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      let err;
      try {
        await github.getInstallations('sometoken');
      } catch (e) {
        err = e;
      }
      expect(err.statusCode).toBe(404);
    });
    it('should retry 502s once', async () => {
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      ghGot.mockImplementationOnce(() => ({
        body: ['a', 'b'],
      }));
      const installations = await github.getInstallations('sometoken');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(installations).toMatchSnapshot();
    });
    it('should retry 502s until success', async () => {
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      ghGot.mockImplementationOnce(() => ({
        body: ['a', 'b'],
      }));
      const installations = await github.getInstallations('sometoken');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(installations).toMatchSnapshot();
    });
    it('should retry until failure', async () => {
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 403,
          message: 'API rate limit exceeded for x.',
        })
      );
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 403,
          message:
            'You have triggered an abuse detection mechanism. Please wait a few minutes before you try again.',
        })
      );
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      let err;
      try {
        await github.getInstallations('sometoken');
      } catch (e) {
        err = e;
      }
      expect(err.statusCode).toBe(404);
    });
    it('should give up after 5 retries', async () => {
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 500,
        })
      );
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 500,
        })
      );
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      let err;
      try {
        await github.getInstallations('sometoken');
      } catch (e) {
        err = e;
      }
      expect(err.statusCode).toBe(502);
    });
  });

  describe('getInstallationToken', () => {
    it('should return an installation token', async () => {
      ghGot.post.mockImplementationOnce(() => ({
        body: {
          token: 'aUserToken',
        },
      }));
      const installationToken = await github.getInstallationToken(
        'sometoken',
        123456
      );
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(installationToken).toMatchSnapshot();
    });
    it('should retry posts', async () => {
      ghGot.post.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      ghGot.post.mockImplementationOnce(() => ({
        body: {
          token: 'aUserToken',
        },
      }));
      const installationToken = await github.getInstallationToken(
        'sometoken',
        123456
      );
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(installationToken).toMatchSnapshot();
    });
    it('should return an error if given one', async () => {
      ghGot.post.mockImplementationOnce(() => {
        throw new Error('error');
      });
      let err;
      try {
        await github.getInstallationToken('sometoken', 123456);
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('error');
    });
  });

  describe('getInstallationRepositories', () => {
    it('should return an array of repositories', async () => {
      ghGot.mockImplementationOnce(() => ({
        body: {
          total_count: 2,
          repositories: ['a', 'b'],
        },
      }));
      const repositories = await github.getInstallationRepositories(
        'sometoken'
      );
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(repositories).toMatchSnapshot();
    });
    it('should return an error if given one', async () => {
      ghGot.mockImplementationOnce(() => {
        throw new Error('error');
      });
      let err;
      try {
        await github.getInstallationRepositories('sometoken');
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('error');
    });
  });

  async function getRepos(...args) {
    // repo info
    ghGot.mockImplementationOnce(() => ({
      body: [
        {
          full_name: 'a/b',
        },
        {
          full_name: 'c/d',
        },
      ],
    }));
    return github.getRepos(...args);
  }

  describe('getRepos', () => {
    it('should throw an error if no token is provided', async () => {
      let err;
      try {
        await github.getRepos();
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('No token found for getRepos');
    });
    it('should return an array of repos', async () => {
      const repos = await getRepos('sometoken');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
    it('should support a custom endpoint', async () => {
      const repos = await getRepos('sometoken', 'someendpoint');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });

  async function initRepo(...args) {
    // repo info
    ghGot.mockImplementationOnce(() => ({
      body: {
        owner: {
          login: 'theowner',
        },
        default_branch: 'master',
        allow_rebase_merge: true,
        allow_squash_merge: true,
        allow_merge_commit: true,
      },
    }));
    // getBranchCommit
    ghGot.mockImplementationOnce(() => ({
      body: {
        object: {
          sha: '1234',
        },
      },
    }));
    // getBranchProtection
    ghGot.mockImplementationOnce(() => ({
      body: {
        strict: false,
      },
    }));
    return github.initRepo(...args);
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
          process.env.GITHUB_TOKEN = envToken;
        }
        const config = await initRepo('some/repo', ...args);
        expect(ghGot.mock.calls).toMatchSnapshot();
        expect(config).toMatchSnapshot();
        expect(process.env.GITHUB_TOKEN).toBe(token);
        expect(process.env.GITHUB_ENDPOINT).toBe(endpoint);
      });
    });
    it('uses provided logger', async () => {
      await initRepo('some/repo', 'some_token', 'an_endpoint', logger);
    });
    it('should throw an error if no token is provided', async () => {
      let err;
      try {
        await github.initRepo('some/repo');
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe(
        'No token found for GitHub repository some/repo'
      );
    });
    it('should rebase', async () => {
      async function squashInitRepo(...args) {
        // repo info
        ghGot.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
            allow_rebase_merge: true,
            allow_squash_merge: true,
            allow_merge_commit: true,
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getBranchProtection
        ghGot.mockImplementationOnce(() => ({
          body: {
            strict: false,
          },
        }));
        return github.initRepo(...args);
      }
      const config = await squashInitRepo('some/repo', 'token');
      expect(config).toMatchSnapshot();
    });
    it('should squash', async () => {
      async function mergeInitRepo(...args) {
        // repo info
        ghGot.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
            allow_rebase_merge: false,
            allow_squash_merge: true,
            allow_merge_commit: true,
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getBranchProtection
        ghGot.mockImplementationOnce(() => ({
          body: {
            strict: false,
          },
        }));
        return github.initRepo(...args);
      }
      const config = await mergeInitRepo('some/repo', 'token');
      expect(config).toMatchSnapshot();
    });
    it('should merge', async () => {
      async function mergeInitRepo(...args) {
        // repo info
        ghGot.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
            allow_rebase_merge: false,
            allow_squash_merge: false,
            allow_merge_commit: true,
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getBranchProtection
        ghGot.mockImplementationOnce(() => ({
          body: {
            strict: false,
          },
        }));
        return github.initRepo(...args);
      }
      const config = await mergeInitRepo('some/repo', 'token');
      expect(config).toMatchSnapshot();
    });
    it('should not guess at merge', async () => {
      async function mergeInitRepo(...args) {
        // repo info
        ghGot.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getBranchProtection
        ghGot.mockImplementationOnce(() => ({
          body: {
            strict: false,
          },
        }));
        return github.initRepo(...args);
      }
      const config = await mergeInitRepo('some/repo', 'token');
      expect(config).toMatchSnapshot();
    });
    it('should detect repoForceRebase', async () => {
      async function mergeInitRepo(...args) {
        // repo info
        ghGot.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getBranchProtection
        ghGot.mockImplementationOnce(() => ({
          body: {
            strict: true,
          },
        }));
        return github.initRepo(...args);
      }
      const config = await mergeInitRepo('some/repo', 'token');
      expect(config).toMatchSnapshot();
    });
    it('should ignore repoForceRebase 404', async () => {
      async function mergeInitRepo(...args) {
        // repo info
        ghGot.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getBranchProtection
        ghGot.mockImplementationOnce(() =>
          Promise.reject({
            statusCode: 404,
          })
        );
        return github.initRepo(...args);
      }
      const config = await mergeInitRepo('some/repo', 'token');
      expect(config).toMatchSnapshot();
    });
    it('should ignore repoForceRebase 403', async () => {
      async function mergeInitRepo(...args) {
        // repo info
        ghGot.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getBranchProtection
        ghGot.mockImplementationOnce(() =>
          Promise.reject({
            statusCode: 403,
          })
        );
        return github.initRepo(...args);
      }
      const config = await mergeInitRepo('some/repo', 'token');
      expect(config).toMatchSnapshot();
    });
    it('should throw repoForceRebase non-404', async () => {
      async function mergeInitRepo(...args) {
        // repo info
        ghGot.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getBranchProtection
        ghGot.mockImplementationOnce(() =>
          Promise.reject({
            statusCode: 600,
          })
        );
        return github.initRepo(...args);
      }
      let e;
      try {
        await mergeInitRepo('some/repo', 'token');
      } catch (err) {
        e = err;
      }
      expect(e.statusCode).toBe(600);
    });
  });
  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1238',
          },
        },
      }));
      await github.setBaseBranch('some-branch');
      expect(ghGot.mock.calls).toMatchSnapshot();
    });
  });
  describe('findFilePaths(fileName)', () => {
    it('should return empty array if none found', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        headers: { link: '' },
        body: {
          items: [],
        },
      }));
      const files = await github.findFilePaths('package.json');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(files.length).toBe(0);
    });
    it('should return the files matching the fileName', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        headers: { link: '' },
        body: {
          items: [
            { name: 'package.json', path: '/package.json' },
            {
              name: 'package.json.something-else',
              path: 'some-dir/package.json.some-thing-else',
            },
            { name: 'package.json', path: 'src/app/package.json' },
            { name: 'package.json', path: 'src/otherapp/package.json' },
          ],
        },
      }));
      const files = await github.findFilePaths('package.json', 'some-content');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(files).toMatchSnapshot();
    });
    it('paginates', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        headers: {
          link:
            '<https://api.github.com/search/code?q=repo%3Arenovate-tests%2Fonboarding-1+filename%3Apackage.json&per_page=2&page=2>; rel="next", <https://api.github.com/search/code?q=repo%3Arenovate-tests%2Fonboarding-1+filename%3Apackage.json&per_page=2&page=2>; rel="last" <https://api.github.com/search/code?q=repo%3Arenovate-tests%2Fonboarding-1+filename%3Apackage.json&per_page=2&page=1>; rel="first", <https://api.github.com/search/code?q=repo%3Arenovate-tests%2Fonboarding-1+filename%3Apackage.json&per_page=2&page=1>; rel="prev"',
        },
        body: {
          items: [
            { name: 'package.json', path: '/package.json' },
            {
              name: 'package.json.something-else',
              path: 'some-dir/package.json.some-thing-else',
            },
          ],
        },
      }));
      ghGot.mockImplementationOnce(() => ({
        headers: { link: '' },
        body: {
          items: [
            { name: 'package.json', path: 'src/app/package.json' },
            { name: 'package.json', path: 'src/otherapp/package.json' },
          ],
        },
      }));
      const files = await github.findFilePaths('package.json');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(files).toMatchSnapshot();
    });
  });
  describe('branchExists(branchName)', () => {
    it('should return true if the branch exists (one result)', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: {
          ref: 'refs/heads/thebranchname',
        },
      }));
      const exists = await github.branchExists('thebranchname');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(exists).toBe(true);
    });
    it('should return true if the branch exists (multiple results)', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: [
          {
            ref: 'refs/heads/notthebranchname',
          },
          {
            ref: 'refs/heads/thebranchname',
          },
        ],
      }));
      const exists = await github.branchExists('thebranchname');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(exists).toBe(true);
    });
    it('should return false if the branch does not exist (one result)', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: {
          ref: 'refs/heads/notthebranchname',
        },
      }));
      const exists = await github.branchExists('thebranchname');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(exists).toBe(false);
    });
    it('should return false if the branch does not exist (multiple results)', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: [
          {
            ref: 'refs/heads/notthebranchname',
          },
          {
            ref: 'refs/heads/alsonotthebranchname',
          },
        ],
      }));
      const exists = await github.branchExists('thebranchname');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(exists).toBe(false);
    });
    it('should return false if a 404 is returned', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      const exists = await github.branchExists('thebranchname');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(exists).toBe(false);
    });
    it('should propagate unknown errors', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() =>
        Promise.reject(new Error('Something went wrong'))
      );
      let err;
      try {
        await github.branchExists('thebranchname');
      } catch (e) {
        err = e;
      }
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(err.message).toBe('Something went wrong');
    });
  });
  describe('getAllRenovateBranches()', () => {
    it('should return all renovate branches', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: [
          {
            ref: 'refs/heads/renovate/a',
          },
          {
            ref: 'refs/heads/master',
          },
          {
            ref: 'refs/heads/renovate/b',
          },
        ],
      }));
      const res = await github.getAllRenovateBranches('renovate/');
      expect(res).toMatchSnapshot();
    });
  });
  describe('isBranchStale(branchName)', () => {
    it('should return false if same SHA as master', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      // getCommitDetails - same as master
      ghGot.mockImplementationOnce(() => ({
        body: {
          parents: [
            {
              sha: '1234',
            },
          ],
        },
      }));
      expect(await github.isBranchStale('thebranchname')).toBe(false);
    });
    it('should return true if SHA different from master', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      // getCommitDetails - different
      ghGot.mockImplementationOnce(() => ({
        body: {
          parents: [
            {
              sha: '12345678',
            },
          ],
        },
      }));
      expect(await github.isBranchStale('thebranchname')).toBe(true);
    });
  });
  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: [],
      }));
      const pr = await github.getBranchPr('somebranch');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(pr).toBe(null);
    });
    it('should return the PR object', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: [{ number: 91 }],
      }));
      ghGot.mockImplementationOnce(() => ({
        body: {
          number: 91,
          additions: 1,
          deletions: 1,
          commits: 1,
          base: {
            sha: '1234',
          },
        },
      }));
      const pr = await github.getBranchPr('somebranch');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getBranchStatus(branchName, requiredStatusChecks)', () => {
    it('returne success if requiredStatusChecks null', async () => {
      await initRepo('some/repo', 'token');
      const res = await github.getBranchStatus('somebranch', null);
      expect(res).toEqual('success');
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      await initRepo('some/repo', 'token');
      const res = await github.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual('failed');
    });
    it('should pass through success', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: {
          state: 'success',
        },
      }));
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('should pass through failed', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: {
          state: 'failed',
        },
      }));
      const res = await github.getBranchStatus('somebranch', []);
      expect(res).toEqual('failed');
    });
  });
  describe('getBranchStatusCheck', () => {
    it('returns state if found', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      ghGot.mockImplementationOnce(() => ({
        body: [
          {
            context: 'context-1',
            state: 'state-1',
          },
          {
            context: 'context-2',
            state: 'state-2',
          },
          {
            context: 'context-3',
            state: 'state-3',
          },
        ],
      }));
      const res = await github.getBranchStatusCheck('somebranch', 'context-2');
      expect(res).toEqual('state-2');
    });
    it('returns null', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      ghGot.mockImplementationOnce(() => ({
        body: [
          {
            context: 'context-1',
            state: 'state-1',
          },
          {
            context: 'context-2',
            state: 'state-2',
          },
          {
            context: 'context-3',
            state: 'state-3',
          },
        ],
      }));
      const res = await github.getBranchStatusCheck('somebranch', 'context-4');
      expect(res).toEqual(null);
    });
  });
  describe('setBranchStatus', () => {
    it('sets branch status', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      await github.setBranchStatus(
        'some-branch',
        'some-context',
        'some-description',
        'some-state',
        'some-url'
      );
      expect(ghGot.post.mock.calls).toHaveLength(1);
    });
  });
  describe('mergeBranch(branchName, mergeType)', () => {
    it('should perform a branch-push merge', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      ghGot.patch.mockImplementationOnce();
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      // deleteBranch
      ghGot.delete.mockImplementationOnce();
      await github.mergeBranch('thebranchname', 'branch-push');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(ghGot.patch.mock.calls).toMatchSnapshot();
      expect(ghGot.post.mock.calls).toMatchSnapshot();
      expect(ghGot.put.mock.calls).toMatchSnapshot();
      expect(ghGot.delete.mock.calls).toMatchSnapshot();
    });
    it('should throw if branch-push merge throws', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      ghGot.patch.mockImplementationOnce(() => {
        throw new Error('branch-push failed');
      });
      let e;
      try {
        await github.mergeBranch('thebranchname', 'branch-push');
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(ghGot.patch.mock.calls).toMatchSnapshot();
      expect(ghGot.post.mock.calls).toMatchSnapshot();
      expect(ghGot.put.mock.calls).toMatchSnapshot();
      expect(ghGot.delete.mock.calls).toMatchSnapshot();
    });
    it('should perform a branch-merge-commit merge', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      await github.mergeBranch('thebranchname', 'branch-merge-commit');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(ghGot.patch.mock.calls).toMatchSnapshot();
      expect(ghGot.post.mock.calls).toMatchSnapshot();
      expect(ghGot.put.mock.calls).toMatchSnapshot();
      expect(ghGot.delete.mock.calls).toMatchSnapshot();
    });
    it('should throw if branch-merge-commit throws', async () => {
      await initRepo('some/repo', 'token');
      ghGot.post.mockImplementationOnce(() => {
        throw new Error('branch-push failed');
      });
      let e;
      try {
        await github.mergeBranch('thebranchname', 'branch-merge-commit');
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(ghGot.patch.mock.calls).toMatchSnapshot();
      expect(ghGot.post.mock.calls).toMatchSnapshot();
      expect(ghGot.put.mock.calls).toMatchSnapshot();
      expect(ghGot.delete.mock.calls).toMatchSnapshot();
    });
    it('should throw if unknown merge type', async () => {
      await initRepo('some/repo', 'token');
      let e;
      try {
        await github.mergeBranch('thebranchname', 'wrong-merge-type');
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(ghGot.patch.mock.calls).toMatchSnapshot();
      expect(ghGot.post.mock.calls).toMatchSnapshot();
      expect(ghGot.put.mock.calls).toMatchSnapshot();
      expect(ghGot.delete.mock.calls).toMatchSnapshot();
    });
  });
  describe('getBranchLastCommitTime', () => {
    it('should return a Date', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockReturnValueOnce({
        body: [
          {
            commit: {
              committer: {
                date: '2011-04-14T16:00:49Z',
              },
            },
          },
        ],
      });
      const res = await github.getBranchLastCommitTime('some-branch');
      expect(res).toMatchSnapshot();
    });
    it('handles error', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockReturnValueOnce({
        body: [],
      });
      const res = await github.getBranchLastCommitTime('some-branch');
      expect(res).toBeDefined();
    });
  });
  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignees to the issue', async () => {
      await initRepo('some/repo', 'token');
      await github.addAssignees(42, ['someuser', 'someotheruser']);
      expect(ghGot.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('addReviewers(issueNo, reviewers)', () => {
    it('should add the given reviewers to the PR', async () => {
      await initRepo('some/repo', 'token');
      await github.addReviewers(42, ['someuser', 'someotheruser']);
      expect(ghGot.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('addLabels(issueNo, labels)', () => {
    it('should add the given labels to the issue', async () => {
      await initRepo('some/repo', 'token');
      await github.addLabels(42, ['foo', 'bar']);
      expect(ghGot.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('findPr(branchName, prTitle, state)', () => {
    it('should return a PR object', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: [{ title: 'PR Title', state: 'open', number: 42 }],
      }));
      const pr = await github.findPr('master', 'PR Title');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(pr).toMatchSnapshot();
    });
    it("should return null if no PR's are found", async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: [],
      }));
      const pr = await github.findPr('master', 'PR Title');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(pr).toBe(null);
    });
    it('should set the isClosed attribute of the PR to true if the PR is closed', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: [{ title: 'PR Title', state: 'closed', number: 42 }],
      }));
      const pr = await github.findPr('master');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(pr).toMatchSnapshot();
    });
  });
  describe('checkForClosedPr(branchName, prTitle)', () => {
    [
      ['some-branch', 'foo', true],
      ['some-branch', 'bar', false],
      ['some-branch', 'bop', false],
    ].forEach(([branch, title, expected], i) => {
      it(`should return true if a closed PR is found - ${i}`, async () => {
        await initRepo('some/repo', 'token');
        ghGot.mockImplementationOnce(() => ({
          body: [
            { title: 'foo', head: { label: 'theowner:some-branch' } },
            { title: 'bar', head: { label: 'theowner:some-other-branch' } },
            { title: 'baz', head: { label: 'theowner:some-branch' } },
          ],
        }));
        const res = await github.checkForClosedPr(branch, title);
        expect(res).toBe(expected);
      });
    });
  });
  describe('createPr(branchName, title, body)', () => {
    it('should create and return a PR object', async () => {
      await initRepo('some/repo', 'token');
      ghGot.post.mockImplementationOnce(() => ({
        body: {
          number: 123,
        },
      }));
      const pr = await github.createPr(
        'some-branch',
        'The Title',
        'Hello world'
      );
      expect(pr).toMatchSnapshot();
      expect(ghGot.post.mock.calls).toMatchSnapshot();
    });
    it('should use defaultBranch', async () => {
      await initRepo('some/repo', 'token');
      ghGot.post.mockImplementationOnce(() => ({
        body: {
          number: 123,
        },
      }));
      const pr = await github.createPr(
        'some-branch',
        'The Title',
        'Hello world',
        true
      );
      expect(pr).toMatchSnapshot();
      expect(ghGot.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('getPr(prNo)', () => {
    it('should return null if no prNo is passed', async () => {
      const pr = await github.getPr(null);
      expect(pr).toBe(null);
    });
    it('should return null if no PR is returned from GitHub', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: null,
      }));
      const pr = await github.getPr(1234);
      expect(pr).toBe(null);
    });
    [
      { number: 1, state: 'closed', base: { sha: '1234' } },
      {
        number: 1,
        state: 'open',
        mergeable_state: 'dirty',
        base: { sha: '1234' },
        commits: 1,
      },
      { number: 1, state: 'open', base: { sha: '5678' }, commits: 1 },
    ].forEach((body, i) => {
      it(`should return a PR object - ${i}`, async () => {
        await initRepo('some/repo', 'token');
        ghGot.mockImplementationOnce(() => ({
          body,
        }));
        const pr = await github.getPr(1234);
        expect(pr).toMatchSnapshot();
      });
    });
    it('should return a rebaseable PR despite multiple commits', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: {
          number: 1,
          state: 'open',
          mergeable_state: 'dirty',
          base: { sha: '1234' },
          commits: 2,
        },
      }));
      ghGot.mockImplementationOnce(() => ({
        body: [
          {
            author: {
              login: 'foo',
            },
          },
        ],
      }));
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
    it('should return an unrebaseable PR if multiple authors', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: {
          number: 1,
          state: 'open',
          mergeable_state: 'dirty',
          base: { sha: '1234' },
          commits: 2,
        },
      }));
      ghGot.mockImplementationOnce(() => ({
        body: [
          {
            author: {
              login: 'foo',
            },
          },
          {
            commit: {
              author: {
                email: 'bar',
              },
            },
          },
          {},
        ],
      }));
      const pr = await github.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getAllPrs()', () => {
    it('maps results to simple array', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: [
          {
            number: 5,
            foo: 'bar',
            head: {
              ref: 'renovate/a',
            },
          },
          {
            number: 6,
            foo: 'bar',
            head: {
              ref: 'not-renovate',
            },
          },
          {
            number: 9,
            foo: 'baz',
            head: {
              ref: 'renovate/b',
            },
          },
        ],
      }));
      const res = await github.getAllPrs();
      expect(res).toMatchSnapshot();
    });
  });
  describe('updatePr(prNo, title, body)', () => {
    it('should update the PR', async () => {
      await initRepo('some/repo', 'token');
      await github.updatePr(1234, 'The New Title', 'Hello world again');
      expect(ghGot.patch.mock.calls).toMatchSnapshot();
    });
  });
  describe('mergePr(prNo)', () => {
    it('should merge the PR', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1235',
          },
        },
      }));
      const pr = {
        number: 1234,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr)).toBe(true);
      expect(ghGot.put.mock.calls).toHaveLength(1);
      expect(ghGot.delete.mock.calls).toHaveLength(1);
      expect(ghGot.mock.calls).toHaveLength(4);
    });
  });
  describe('mergePr(prNo)', () => {
    it('should handle merge error', async () => {
      await initRepo('some/repo', 'token');
      const pr = {
        number: 1234,
        head: {
          ref: 'someref',
        },
      };
      ghGot.put.mockImplementationOnce(() => {
        throw new Error('merge error');
      });
      expect(await github.mergePr(pr)).toBe(false);
      expect(ghGot.put.mock.calls).toHaveLength(1);
      expect(ghGot.delete.mock.calls).toHaveLength(0);
      expect(ghGot.mock.calls).toHaveLength(3);
    });
  });
  describe('mergePr(prNo) - autodetection', () => {
    beforeEach(async () => {
      async function guessInitRepo(...args) {
        // repo info
        ghGot.mockImplementationOnce(() => ({
          body: {
            owner: {
              login: 'theowner',
            },
            default_branch: 'master',
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1234',
            },
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1235',
            },
          },
        }));
        // getBranchCommit
        ghGot.mockImplementationOnce(() => ({
          body: {
            object: {
              sha: '1235',
            },
          },
        }));
        return github.initRepo(...args);
      }
      await guessInitRepo('some/repo', 'token');
      ghGot.put = jest.fn();
    });
    it('should try rebase first', async () => {
      const pr = {
        number: 1235,
        head: {
          ref: 'someref',
        },
      };
      expect(await github.mergePr(pr)).toBe(true);
      expect(ghGot.put.mock.calls).toHaveLength(1);
      expect(ghGot.delete.mock.calls).toHaveLength(1);
    });
    it('should try squash after rebase', async () => {
      const pr = {
        number: 1236,
        head: {
          ref: 'someref',
        },
      };
      ghGot.put.mockImplementationOnce(() => {
        throw new Error('no rebasing allowed');
      });
      await github.mergePr(pr);
      expect(ghGot.put.mock.calls).toHaveLength(2);
      expect(ghGot.delete.mock.calls).toHaveLength(1);
    });
    it('should try merge after squash', async () => {
      const pr = {
        number: 1237,
        head: {
          ref: 'someref',
        },
      };
      ghGot.put.mockImplementationOnce(() => {
        throw new Error('no rebasing allowed');
      });
      ghGot.put.mockImplementationOnce(() => {
        throw new Error('no squashing allowed');
      });
      expect(await github.mergePr(pr)).toBe(true);
      expect(ghGot.put.mock.calls).toHaveLength(3);
      expect(ghGot.delete.mock.calls).toHaveLength(1);
    });
    it('should give up', async () => {
      const pr = {
        number: 1237,
        head: {
          ref: 'someref',
        },
      };
      ghGot.put.mockImplementationOnce(() => {
        throw new Error('no rebasing allowed');
      });
      ghGot.put.mockImplementationOnce(() => {
        throw new Error('no squashing allowed');
      });
      ghGot.put.mockImplementationOnce(() => {
        throw new Error('no merging allowed');
      });
      expect(await github.mergePr(pr)).toBe(false);
      expect(ghGot.put.mock.calls).toHaveLength(3);
      expect(ghGot.delete.mock.calls).toHaveLength(0);
    });
  });
  describe('getFile(filePatch, branchName)', () => {
    it('should return the encoded file content', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: {
          content: 'hello',
        },
      }));
      const content = await github.getFile('package.json');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(content).toBe('hello');
    });
  });
  describe('getFileContent(filePatch, branchName)', () => {
    it('should return the encoded file content', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('hello world').toString('base64'),
        },
      }));
      const content = await github.getFileContent('package.json');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(content).toBe('hello world');
    });
    it('should return null if GitHub returns a 404', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      const content = await github.getFileContent('package.json');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(content).toBe(null);
    });
    it('should return propagate unknown errors', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => {
        throw new Error('Something went wrong');
      });
      let err;
      try {
        await github.getFileContent('package.json');
      } catch (e) {
        err = e;
      }
      expect(err.message).toBe('Something went wrong');
    });
  });
  describe('getFileJson(filePatch, branchName)', () => {
    it('should return the file contents parsed as JSON', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{"hello": "world"}').toString('base64'),
        },
      }));
      const content = await github.getFileJson('package.json');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(content).toMatchSnapshot();
    });
  });
  describe('getFileJson(filePatch, branchName)', () => {
    it('should return null if invalid JSON', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('{hello: "world"}').toString('base64'),
        },
      }));
      const content = await github.getFileJson('package.json');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(content).toBeNull();
    });
  });
  describe('getSubDirectories(path)', () => {
    it('should return subdirectories', async () => {
      await initRepo('some/repo', 'token');
      ghGot.mockImplementationOnce(() => ({
        body: [{ type: 'dir', name: 'a' }, { type: 'file', name: 'b' }],
      }));
      const dirList = await github.getSubDirectories('some-path');
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(dirList).toHaveLength(1);
      expect(dirList).toMatchSnapshot();
    });
  });
  describe('commitFilesToBranch(branchName, files, message, parentBranch)', () => {
    beforeEach(async () => {
      await initRepo('some/repo', 'token');

      // getBranchCommit
      ghGot.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1111',
          },
        },
      }));

      // getCommitTree
      ghGot.mockImplementationOnce(() => ({
        body: {
          tree: {
            sha: '2222',
          },
        },
      }));

      // createBlob
      ghGot.post.mockImplementationOnce(() => ({
        body: {
          sha: '3333',
        },
      }));

      // createTree
      ghGot.post.mockImplementationOnce(() => ({
        body: {
          sha: '4444',
        },
      }));

      // createCommit
      ghGot.post.mockImplementationOnce(() => ({
        body: {
          sha: '5555',
        },
      }));
    });
    it('should add a new commit to the branch', async () => {
      // branchExists
      ghGot.mockImplementationOnce(() => ({
        body: {
          ref: 'refs/heads/package.json',
        },
      }));
      const files = [
        {
          name: 'package.json',
          contents: 'hello world',
        },
      ];
      await github.commitFilesToBranch(
        'package.json',
        files,
        'my commit message'
      );
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(ghGot.post.mock.calls).toMatchSnapshot();
      expect(ghGot.patch.mock.calls).toMatchSnapshot();
    });
    it('should add a commit to a new branch if the branch does not already exist', async () => {
      // branchExists
      ghGot.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      const files = [
        {
          name: 'package.json',
          contents: 'hello world',
        },
      ];
      await github.commitFilesToBranch(
        'package.json',
        files,
        'my other commit message'
      );
      expect(ghGot.mock.calls).toMatchSnapshot();
      expect(ghGot.post.mock.calls).toMatchSnapshot();
      expect(ghGot.patch.mock.calls).toMatchSnapshot();
    });
  });
  describe('getCommitMessages()', () => {
    it('returns commits messages', async () => {
      ghGot.mockReturnValueOnce({
        body: [
          {
            commit: { message: 'foo' },
          },
          {
            commit: { message: 'bar' },
          },
        ],
      });
      const res = await github.getCommitMessages();
      expect(res).toMatchSnapshot();
    });
    it('swallows errors', async () => {
      ghGot.mockImplementationOnce(() => {
        throw new Error('some-error');
      });
      const res = await github.getCommitMessages();
      expect(res).toHaveLength(0);
    });
  });
});
