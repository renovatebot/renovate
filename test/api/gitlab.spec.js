const logger = require('../_fixtures/logger');

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
    it('should fetch multiple pages', async () => {
      const repoCount = 250;
      const projects = [];
      for (let i = 0; i < repoCount; i += 1) {
        projects.push({ path_with_namespace: `project${i}` });
      }
      glGot.mockImplementationOnce(() => ({
        body: projects.slice(0, 100),
      }));
      glGot.mockImplementationOnce(() => ({
        body: projects.slice(100, 200),
      }));
      glGot.mockImplementationOnce(() => ({
        body: projects.slice(200),
      }));
      const repos = await gitlab.getRepos('sometoken');
      expect(glGot.mock.calls).toMatchSnapshot();
      expect(repos.length).toBe(repoCount);
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
    it('should return empty array', async () => {
      await initRepo('some/repo', 'token');
      const files = await gitlab.findFilePaths('package.json');
      expect(files.length).toBe(0);
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
  describe('getBranch', () => {
    it('returns a branch', async () => {
      glGot.mockReturnValueOnce({ body: 'foo' });
      const branch = await gitlab.getBranch('branch-name');
      expect(branch).toMatchSnapshot();
    });
    it('nulls on error', async () => {
      glGot.mockImplementationOnce(() => {
        throw new Error('not found');
      });
      const branch = await gitlab.getBranch('branch-name');
      expect(branch).toBe(null);
    });
  });
  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo('some/repo', 'token');
      glGot.mockImplementationOnce(() => ({
        body: [],
      }));
      const pr = await gitlab.getBranchPr('somebranch');
      expect(glGot.mock.calls).toMatchSnapshot();
      expect(pr).toBe(null);
    });
    it('should return the PR object', async () => {
      await initRepo('some/repo', 'token');
      glGot.mockImplementationOnce(() => ({
        body: [{ number: 91, source_branch: 'somebranch' }],
      }));
      glGot.mockImplementationOnce(() => ({
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
      const pr = await gitlab.getBranchPr('somebranch');
      expect(glGot.mock.calls).toMatchSnapshot();
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getBranchStatus(branchName)', () => {
    beforeEach(() => {
      glGot.mockReturnValueOnce({
        body: {
          commit: {
            id: 1,
          },
        },
      });
    });
    it('returns pending if no results', async () => {
      glGot.mockReturnValueOnce({
        body: [],
      });
      const res = await gitlab.getBranchStatus('some-branch');
      expect(res).toEqual('pending');
    });
    it('returns success if all are success', async () => {
      glGot.mockReturnValueOnce({
        body: [{ status: 'success' }, { status: 'success' }],
      });
      const res = await gitlab.getBranchStatus('some-branch');
      expect(res).toEqual('success');
    });
    it('returns failure if any are failed', async () => {
      glGot.mockReturnValueOnce({
        body: [{ status: 'success' }, { status: 'failed' }],
      });
      const res = await gitlab.getBranchStatus('some-branch');
      expect(res).toEqual('failure');
    });
    it('returns custom statuses', async () => {
      glGot.mockReturnValueOnce({
        body: [{ status: 'success' }, { status: 'foo' }],
      });
      const res = await gitlab.getBranchStatus('some-branch');
      expect(res).toEqual('foo');
    });
  });
  describe('deleteBranch(branchName)', () => {
    it('should send delete', async () => {
      glGot.delete = jest.fn();
      await gitlab.deleteBranch('some-branch');
      expect(glGot.delete.mock.calls.length).toBe(1);
    });
  });
  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignees to the issue', async () => {
      await initRepo('some/repo', 'token');
      await gitlab.addAssignees(42, ['someuser']);
      expect(glGot.put.mock.calls).toMatchSnapshot();
    });
    it('should log error if more than one assignee', async () => {
      await initRepo('some/repo', 'token');
      await gitlab.addAssignees(42, ['someuser', 'someotheruser']);
      expect(glGot.put.mock.calls).toMatchSnapshot();
    });
  });
  describe('addReviewers(issueNo, reviewers)', () => {
    it('should add the given reviewers to the PR', async () => {
      await initRepo('some/repo', 'token');
      await gitlab.addReviewers(42, ['someuser', 'someotheruser']);
    });
  });
  describe('addLabels(issueNo, labels)', () => {
    it('should add the given labels to the issue', async () => {
      await initRepo('some/repo', 'token');
      await gitlab.addLabels(42, ['foo', 'bar']);
      expect(glGot.put.mock.calls).toMatchSnapshot();
    });
  });
  describe('findPr(branchName, prTitle, state)', () => {
    it('returns null if no results', async () => {
      glGot.mockReturnValueOnce({
        body: [],
      });
      const pr = await gitlab.findPr('some-branch');
      expect(pr).toBe(null);
    });
    it('returns null if no matching titles', async () => {
      glGot.mockReturnValueOnce({
        body: [
          {
            source_branch: 'some-branch',
            id: 1,
          },
          {
            source_branch: 'some-branch',
            id: 2,
            title: 'foo',
          },
        ],
      });
      const pr = await gitlab.findPr('some-branch', 'some-title');
      expect(pr).toBe(null);
    });
    it('returns last result if multiple match', async () => {
      glGot.mockReturnValueOnce({
        body: [
          {
            source_branch: 'some-branch',
            id: 1,
          },
          {
            source_branch: 'some-branch',
            id: 2,
          },
        ],
      });
      const pr = await gitlab.findPr('some-branch');
      expect(pr.number).toBe(2);
    });
  });
  describe('checkForClosedPr(branchName, prTitle)', () => {
    it('returns true if pr exists', async () => {
      glGot.mockReturnValueOnce({
        body: [
          {
            source_branch: 'some-branch',
            id: 1,
          },
          {
            source_branch: 'some-branch',
            id: 2,
          },
        ],
      });
      const res = await gitlab.checkForClosedPr('some-branch');
      expect(res).toBe(true);
    });
    it('returns false if pr does not exist', async () => {
      glGot.mockReturnValueOnce({
        body: [],
      });
      const res = await gitlab.checkForClosedPr('some-branch');
      expect(res).toBe(false);
    });
  });
  describe('createPr(branchName, title, body)', () => {
    it('returns the PR', async () => {
      glGot.post.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
        },
      });
      const pr = await gitlab.createPr('some-branch', 'some-title', 'the-body');
      expect(pr).toMatchSnapshot();
      expect(glGot.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('getPr(prNo)', () => {
    it('returns the PR', async () => {
      glGot.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
          description: 'a merge request',
          state: 'merged',
          merge_status: 'cannot_be_merged',
        },
      });
      glGot.mockReturnValueOnce({
        body: {
          commit: {},
        },
      });
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
    });
  });
  describe('updatePr(prNo, title, body)', () => {
    jest.resetAllMocks();
    it('updates the PR', async () => {
      await gitlab.updatePr(1, 'title', 'body');
      expect(glGot.put.mock.calls.length).toEqual(1);
    });
  });
  describe('mergePr(pr)', () => {
    jest.resetAllMocks();
    it('merges the PR', async () => {
      await gitlab.mergePr({ number: 1 });
      expect(glGot.put.mock.calls.length).toEqual(1);
    });
  });
  describe('getFile(filePath, branchName)', () => {
    it('gets the file with v4 by default', async () => {
      glGot.mockReturnValueOnce({
        body: {
          content: 'foo',
        },
      });
      const res = await gitlab.getFile('some-path', 'some-branch');
      expect(res).toMatchSnapshot();
      expect(glGot.mock.calls[0][0].indexOf('file_path')).toBe(-1);
    });
    it('gets the file with v3', async () => {
      glGot.mockReturnValueOnce({
        body: {},
      });
      glGot.mockReturnValueOnce({
        body: {},
      });
      glGot.mockReturnValueOnce({
        body: {},
      });
      glGot.mockReturnValueOnce({
        body: {
          content: 'foo',
        },
      });
      const config = await gitlab.initRepo('some-repo', 'some-token');
      expect(config).toMatchSnapshot();
      const res = await gitlab.getFile('some-path', 'some-branch');
      expect(res).toMatchSnapshot();
      expect(glGot.mock.calls[3][0].indexOf('file_path')).not.toBe(-1);
    });
  });
  describe('getFileContent(filePath, branchName)', () => {
    it('gets the file', async () => {
      glGot.mockReturnValueOnce({
        body: {
          content: 'foo',
        },
      });
      const res = await gitlab.getFileContent('some-path', 'some-branch');
      expect(res).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      glGot.mockImplementationOnce(() => Promise.reject({ statusCode: 404 }));
      const res = await gitlab.getFileContent('some-path', 'some-branch');
      expect(res).toBe(null);
    });
    it('throws error for non-404', async () => {
      glGot.mockImplementationOnce(() => Promise.reject({ statusCode: 403 }));
      let e;
      try {
        await gitlab.getFileContent('some-path', 'some-branch');
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
    });
  });
  describe('getFileJson(filePath, branchName)', () => {
    it('returns null for 404', async () => {
      glGot.mockImplementationOnce(() => Promise.reject({ statusCode: 404 }));
      const res = await gitlab.getFileJson('some-path', 'some-branch');
      expect(res).toBe(null);
    });
  });
  describe('createFile(branchName, filePath, fileContents, message)', () => {
    it('creates file with v4', async () => {
      await gitlab.createFile(
        'some-branch',
        'some-path',
        'some-contents',
        'some-message'
      );
      expect(glGot.post.mock.calls).toMatchSnapshot();
      expect(glGot.post.mock.calls[0][1].body.file_path).not.toBeDefined();
    });
    it('creates file with v3', async () => {
      glGot.mockReturnValueOnce({
        body: {},
      });
      glGot.mockReturnValueOnce({
        body: {},
      });
      glGot.mockReturnValueOnce({
        body: {},
      });
      await gitlab.initRepo('some-repo', 'some-token');
      await gitlab.createFile(
        'some-branch',
        'some-path',
        'some-contents',
        'some-message'
      );
      expect(glGot.post.mock.calls).toMatchSnapshot();
      expect(glGot.post.mock.calls[0][1].body.file_path).toBeDefined();
    });
    describe('updateFile(branchName, filePath, fileContents, message)', () => {
      it('creates file with v4', async () => {
        await gitlab.updateFile(
          'some-branch',
          'some-path',
          'some-contents',
          'some-message'
        );
        expect(glGot.put.mock.calls).toMatchSnapshot();
        expect(glGot.put.mock.calls[0][1].body.file_path).not.toBeDefined();
      });
      it('creates file with v3', async () => {
        glGot.mockReturnValueOnce({
          body: {},
        });
        glGot.mockReturnValueOnce({
          body: {},
        });
        glGot.mockReturnValueOnce({
          body: {},
        });
        await gitlab.initRepo('some-repo', 'some-token');
        await gitlab.updateFile(
          'some-branch',
          'some-path',
          'some-contents',
          'some-message'
        );
        expect(glGot.put.mock.calls).toMatchSnapshot();
        expect(glGot.put.mock.calls[0][1].body.file_path).toBeDefined();
      });
    });
    describe('createBranch(branchName)', () => {
      it('creates file with v4', async () => {
        await gitlab.createBranch('some-branch');
        expect(glGot.post.mock.calls).toMatchSnapshot();
        expect(glGot.post.mock.calls[0][1].body.branch_name).not.toBeDefined();
      });
      it('creates file with v3', async () => {
        glGot.mockReturnValueOnce({
          body: {},
        });
        glGot.mockReturnValueOnce({
          body: {},
        });
        glGot.mockReturnValueOnce({
          body: {},
        });
        await gitlab.initRepo('some-repo', 'some-token');
        await gitlab.createBranch('some-branch');
        expect(glGot.post.mock.calls).toMatchSnapshot();
        expect(glGot.post.mock.calls[0][1].body.branch_name).toBeDefined();
      });
    });
    describe('commitFilesToBranch(branchName, files, message, parentBranch)', () => {
      it('creates branch', async () => {
        glGot.mockReturnValueOnce({ statusCode: 404 });
        await gitlab.commitFilesToBranch('some-branch', [], 'some-message');
      });
      it('does not create branch and updates file', async () => {
        glGot.mockReturnValueOnce({ statusCode: 200 });
        glGot.mockReturnValueOnce({
          body: {
            content: 'hello',
          },
        });
        const file = {
          name: 'foo',
          contents: 'bar',
        };
        await gitlab.commitFilesToBranch(
          'some-branch',
          [file],
          'some-message',
          'parent-branch'
        );
      });
      it('does not create branch and creates file', async () => {
        glGot.mockReturnValueOnce({ statusCode: 200 });
        glGot.mockReturnValueOnce(Promise.reject({ statusCode: 404 }));
        const file = {
          name: 'foo',
          contents: 'bar',
        };
        await gitlab.commitFilesToBranch(
          'some-branch',
          [file],
          'some-message',
          'parent-branch'
        );
      });
    });
  });
});
