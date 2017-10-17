const logger = require('../_fixtures/logger');

describe('api/gitlab', () => {
  let gitlab;
  let get;
  beforeEach(() => {
    // clean up env
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_ENDPOINT;

    // reset module
    jest.resetModules();
    jest.mock('gl-got');
    gitlab = require('../../lib/api/gitlab');
    get = require('gl-got');
  });

  describe('getRepos', () => {
    async function getRepos(...args) {
      // repo info
      get.mockImplementationOnce(() => ({
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
      get.mockImplementation(() => {
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
      expect(get.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
    it('should support a custom endpoint', async () => {
      const repos = await getRepos('sometoken', 'someendpoint');
      expect(get.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
    it('should fetch multiple pages', async () => {
      const repoCount = 250;
      const projects = [];
      for (let i = 0; i < repoCount; i += 1) {
        projects.push({ path_with_namespace: `project${i}` });
      }
      get.mockImplementationOnce(() => ({
        body: projects.slice(0, 100),
      }));
      get.mockImplementationOnce(() => ({
        body: projects.slice(100, 200),
      }));
      get.mockImplementationOnce(() => ({
        body: projects.slice(200),
      }));
      const repos = await gitlab.getRepos('sometoken');
      expect(get.mock.calls).toMatchSnapshot();
      expect(repos.length).toBe(repoCount);
    });
  });

  async function initRepo(...args) {
    // projects/owned
    get.mockImplementationOnce();
    // projects/${config.repoName
    get.mockImplementationOnce(() => ({
      body: {
        default_branch: 'master',
      },
    }));
    // user
    get.mockImplementationOnce(() => ({
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
        expect(get.mock.calls).toMatchSnapshot();
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
      get.mockImplementation(() => {
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
      get.mockImplementationOnce(() => {
        throw new Error('any error');
      });
      // projects/${config.repoName
      get.mockImplementationOnce(() => ({
        body: {
          default_branch: 'master',
        },
      }));
      // user
      get.mockImplementationOnce(() => ({
        body: {
          email: 'a@b.com',
        },
      }));
      const config = await initRepo('some/repo', 'some_token');
      expect(config).toMatchSnapshot();
    });
  });
  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      get.mockImplementationOnce(() => ({
        body: {
          object: {
            sha: '1238',
          },
        },
      }));
      await gitlab.setBaseBranch('some-branch');
      expect(get.mock.calls).toMatchSnapshot();
    });
  });
  describe('findFilePaths(fileName)', () => {
    it('warns if truncated result', async () => {
      await initRepo('some/repo', 'token');
      get.mockImplementationOnce(() => ({
        body: [],
      }));
      const files = await gitlab.findFilePaths('package.json');
      expect(files.length).toBe(0);
    });
    it('caches the result', async () => {
      await initRepo('some/repo', 'token');
      get.mockImplementationOnce(() => ({
        body: [],
      }));
      let files = await gitlab.findFilePaths('package.json');
      expect(files.length).toBe(0);
      files = await gitlab.findFilePaths('package.js');
      expect(files.length).toBe(0);
    });
    it('should return the files matching the fileName', async () => {
      await initRepo('some/repo', 'token');
      get.mockImplementationOnce(() => ({
        body: [
          { type: 'blob', path: 'package.json' },
          {
            type: 'blob',
            path: 'some-dir/package.json.some-thing-else',
          },
          { type: 'blob', path: 'src/app/package.json' },
          { type: 'blob', path: 'src/otherapp/package.json' },
        ],
      }));
      const files = await gitlab.findFilePaths('package.json');
      expect(files).toMatchSnapshot();
    });
  });
  describe('branchExists(branchName)', () => {
    it('should return true if 200 OK', async () => {
      get.mockImplementationOnce(() => ({ statusCode: 200 }));
      const branchExists = await gitlab.branchExists('foo');
      expect(branchExists).toBe(true);
    });
    it('should return false if not 200 OK', async () => {
      get.mockImplementationOnce(() => ({ statusCode: 500 }));
      const branchExists = await gitlab.branchExists('foo');
      expect(branchExists).toBe(false);
    });
    it('should return false if 404 error received', async () => {
      get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      const branchExists = await gitlab.branchExists('foo');
      expect(branchExists).toBe(false);
    });
    it('should return error if non-404 error thrown', async () => {
      get.mockImplementationOnce(() =>
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
      get.mockReturnValueOnce({ body: 'foo' });
      const branch = await gitlab.getBranch('branch-name');
      expect(branch).toMatchSnapshot();
    });
    it('nulls on error', async () => {
      get.mockImplementationOnce(() => {
        throw new Error('not found');
      });
      const branch = await gitlab.getBranch('branch-name');
      expect(branch).toBe(null);
    });
  });
  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo('some/repo', 'token');
      get.mockImplementationOnce(() => ({
        body: [],
      }));
      const pr = await gitlab.getBranchPr('somebranch');
      expect(get.mock.calls).toMatchSnapshot();
      expect(pr).toBe(null);
    });
    it('should return the PR object', async () => {
      await initRepo('some/repo', 'token');
      get.mockImplementationOnce(() => ({
        body: [{ number: 91, source_branch: 'somebranch' }],
      }));
      get.mockImplementationOnce(() => ({
        body: {
          iid: 91,
          additions: 1,
          deletions: 1,
          commits: 1,
          source_branch: 'some-branch',
          base: {
            sha: '1234',
          },
        },
      }));
      const pr = await gitlab.getBranchPr('somebranch');
      expect(get.mock.calls).toMatchSnapshot();
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getBranchStatus(branchName, requiredStatusChecks)', () => {
    beforeEach(() => {
      get.mockReturnValueOnce({
        body: {
          commit: {
            id: 1,
          },
        },
      });
    });
    it('returns success if requiredStatusChecks null', async () => {
      await initRepo('some/repo', 'token');
      const res = await gitlab.getBranchStatus('somebranch', null);
      expect(res).toEqual('success');
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      await initRepo('some/repo', 'token');
      const res = await gitlab.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual('failed');
    });
    it('returns pending if no results', async () => {
      get.mockReturnValueOnce({
        body: [],
      });
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual('pending');
    });
    it('returns success if all are success', async () => {
      get.mockReturnValueOnce({
        body: [{ status: 'success' }, { status: 'success' }],
      });
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual('success');
    });
    it('returns failure if any are failed', async () => {
      get.mockReturnValueOnce({
        body: [{ status: 'success' }, { status: 'failed' }],
      });
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual('failure');
    });
    it('returns custom statuses', async () => {
      get.mockReturnValueOnce({
        body: [{ status: 'success' }, { status: 'foo' }],
      });
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual('foo');
    });
  });
  describe('getBranchStatusCheck', () => {
    beforeEach(() => {
      get.mockReturnValueOnce({
        body: {
          commit: {
            id: 1,
          },
        },
      });
    });
    it('returns null if no results', async () => {
      get.mockReturnValueOnce({
        body: [],
      });
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toEqual(null);
    });
    it('returns null if no matching results', async () => {
      get.mockReturnValueOnce({
        body: [{ name: 'context-1', status: 'pending' }],
      });
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toEqual(null);
    });
    it('returns status if name found', async () => {
      get.mockReturnValueOnce({
        body: [
          { name: 'context-1', state: 'pending' },
          { name: 'some-context', state: 'success' },
          { name: 'context-3', state: 'failed' },
        ],
      });
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toEqual('success');
    });
  });
  describe('setBranchStatus', () => {
    it('sets branch status', async () => {
      await initRepo('some/repo', 'token');
      // getBranchCommit
      get.mockReturnValueOnce({
        body: {
          commit: {
            id: 1,
          },
        },
      });
      await gitlab.setBranchStatus(
        'some-branch',
        'some-context',
        'some-description',
        'some-state',
        'some-url'
      );
      expect(get.post.mock.calls).toHaveLength(1);
    });
  });
  describe('deleteBranch(branchName)', () => {
    it('should send delete', async () => {
      get.delete = jest.fn();
      await gitlab.deleteBranch('some-branch');
      expect(get.delete.mock.calls.length).toBe(1);
    });
  });
  describe('getBranchLastCommitTime', () => {
    it('should return a Date', async () => {
      await initRepo('some/repo', 'token');
      get.mockReturnValueOnce({
        body: [
          {
            id: 'ed899a2f4b50b4370feeea94676502b42383c746',
            short_id: 'ed899a2f4b5',
            title: 'Replace sanitize with escape once',
            author_name: 'Dmitriy Zaporozhets',
            author_email: 'dzaporozhets@sphereconsultinginc.com',
            authored_date: '2012-09-20T11:50:22+03:00',
            committer_name: 'Administrator',
            committer_email: 'admin@example.com',
            committed_date: '2012-09-20T11:50:22+03:00',
            created_at: '2012-09-20T11:50:22+03:00',
            message: 'Replace sanitize with escape once',
            parent_ids: ['6104942438c14ec7bd21c6cd5bd995272b3faff6'],
          },
          {
            id: '6104942438c14ec7bd21c6cd5bd995272b3faff6',
            short_id: '6104942438c',
            title: 'Sanitize for network graph',
            author_name: 'randx',
            author_email: 'dmitriy.zaporozhets@gmail.com',
            committer_name: 'Dmitriy',
            committer_email: 'dmitriy.zaporozhets@gmail.com',
            created_at: '2012-09-20T09:06:12+03:00',
            message: 'Sanitize for network graph',
            parent_ids: ['ae1d9fb46aa2b07ee9836d49862ec4e2c46fbbba'],
          },
        ],
      });
      const res = await gitlab.getBranchLastCommitTime('some-branch');
      expect(res).toMatchSnapshot();
    });
    it('handles error', async () => {
      await initRepo('some/repo', 'token');
      get.mockReturnValueOnce({
        body: [],
      });
      const res = await gitlab.getBranchLastCommitTime('some-branch');
      expect(res).toBeDefined();
    });
  });
  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignees to the issue', async () => {
      await initRepo('some/repo', 'token');
      await gitlab.addAssignees(42, ['someuser']);
      expect(get.put.mock.calls).toMatchSnapshot();
    });
    it('should log error if more than one assignee', async () => {
      await initRepo('some/repo', 'token');
      await gitlab.addAssignees(42, ['someuser', 'someotheruser']);
      expect(get.put.mock.calls).toMatchSnapshot();
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
      expect(get.put.mock.calls).toMatchSnapshot();
    });
  });
  describe('findPr(branchName, prTitle, state)', () => {
    it('returns null if no results', async () => {
      get.mockReturnValueOnce({
        body: [],
      });
      const pr = await gitlab.findPr('some-branch');
      expect(pr).toBe(null);
    });
    it('returns null if no matching titles', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            source_branch: 'some-branch',
            iid: 1,
          },
          {
            source_branch: 'some-branch',
            iid: 2,
            title: 'foo',
          },
        ],
      });
      const pr = await gitlab.findPr('some-branch', 'some-title');
      expect(pr).toBe(null);
    });
    it('returns last result if multiple match', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            source_branch: 'some-branch',
            iid: 1,
          },
          {
            source_branch: 'some-branch',
            iid: 2,
          },
        ],
      });
      const pr = await gitlab.findPr('some-branch');
      expect(pr.number).toBe(2);
    });
  });
  describe('checkForClosedPr(branchName, prTitle)', () => {
    it('returns true if pr exists', async () => {
      get.mockReturnValueOnce({
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
      get.mockReturnValueOnce({
        body: [],
      });
      const res = await gitlab.checkForClosedPr('some-branch');
      expect(res).toBe(false);
    });
  });
  describe('createPr(branchName, title, body)', () => {
    it('returns the PR', async () => {
      get.post.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
        },
      });
      const pr = await gitlab.createPr('some-branch', 'some-title', 'the-body');
      expect(pr).toMatchSnapshot();
      expect(get.post.mock.calls).toMatchSnapshot();
    });
    it('uses default branch', async () => {
      get.post.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
        },
      });
      const pr = await gitlab.createPr(
        'some-branch',
        'some-title',
        'the-body',
        true
      );
      expect(pr).toMatchSnapshot();
      expect(get.post.mock.calls).toMatchSnapshot();
    });
  });
  describe('getPr(prNo)', () => {
    it('returns the PR', async () => {
      get.mockReturnValueOnce({
        body: {
          id: 1,
          iid: 12345,
          description: 'a merge request',
          state: 'merged',
          merge_status: 'cannot_be_merged',
          source_branch: 'some-branch',
        },
      });
      get.mockReturnValueOnce({
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
      expect(get.put.mock.calls.length).toEqual(1);
    });
  });
  describe('mergePr(pr)', () => {
    jest.resetAllMocks();
    it('merges the PR', async () => {
      await gitlab.mergePr({ number: 1 });
      expect(get.put.mock.calls.length).toEqual(1);
    });
  });
  describe('getFile(filePath, branchName)', () => {
    it('gets the file with v4 by default', async () => {
      get.mockReturnValueOnce({
        body: {
          content: 'foo',
        },
      });
      const res = await gitlab.getFile('some/path');
      expect(res).toMatchSnapshot();
      expect(get.mock.calls[0][0].indexOf('some%2Fpath')).not.toBe(-1);
    });
    it('gets the file with v3', async () => {
      get.mockReturnValueOnce({
        body: {},
      });
      get.mockReturnValueOnce({
        body: {},
      });
      get.mockReturnValueOnce({
        body: {},
      });
      get.mockReturnValueOnce({
        body: {
          content: 'foo',
        },
      });
      const config = await gitlab.initRepo('some-repo', 'some-token');
      expect(config).toMatchSnapshot();
      const res = await gitlab.getFile('some-path');
      expect(res).toMatchSnapshot();
      expect(get.mock.calls[3][0].indexOf('file_path')).not.toBe(-1);
    });
  });
  describe('getFileContent(filePath, branchName)', () => {
    it('gets the file', async () => {
      get.mockReturnValueOnce({
        body: {
          content: 'foo',
        },
      });
      const res = await gitlab.getFileContent('some-path', 'some-branch');
      expect(res).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      get.mockImplementationOnce(() => Promise.reject({ statusCode: 404 }));
      const res = await gitlab.getFileContent('some-path', 'some-branch');
      expect(res).toBe(null);
    });
    it('throws error for non-404', async () => {
      get.mockImplementationOnce(() => Promise.reject({ statusCode: 403 }));
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
      get.mockImplementationOnce(() => Promise.reject({ statusCode: 404 }));
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
      expect(get.post.mock.calls).toMatchSnapshot();
      expect(get.post.mock.calls[0][1].body.file_path).not.toBeDefined();
    });
    it('creates file with v3', async () => {
      get.mockReturnValueOnce({
        body: {},
      });
      get.mockReturnValueOnce({
        body: {},
      });
      get.mockReturnValueOnce({
        body: {},
      });
      await gitlab.initRepo('some-repo', 'some-token');
      await gitlab.createFile(
        'some-branch',
        'some-path',
        'some-contents',
        'some-message'
      );
      expect(get.post.mock.calls).toMatchSnapshot();
      expect(get.post.mock.calls[0][1].body.file_path).toBeDefined();
    });
    describe('updateFile(branchName, filePath, fileContents, message)', () => {
      it('creates file with v4', async () => {
        await gitlab.updateFile(
          'some-branch',
          'some-path',
          'some-contents',
          'some-message'
        );
        expect(get.put.mock.calls).toMatchSnapshot();
        expect(get.put.mock.calls[0][1].body.file_path).not.toBeDefined();
      });
      it('creates file with v3', async () => {
        get.mockReturnValueOnce({
          body: {},
        });
        get.mockReturnValueOnce({
          body: {},
        });
        get.mockReturnValueOnce({
          body: {},
        });
        await gitlab.initRepo('some-repo', 'some-token');
        await gitlab.updateFile(
          'some-branch',
          'some-path',
          'some-contents',
          'some-message'
        );
        expect(get.put.mock.calls).toMatchSnapshot();
        expect(get.put.mock.calls[0][1].body.file_path).toBeDefined();
      });
    });
    describe('createBranch(branchName)', () => {
      it('creates file with v4', async () => {
        await gitlab.createBranch('some-branch');
        expect(get.post.mock.calls).toMatchSnapshot();
        expect(get.post.mock.calls[0][1].body.branch_name).not.toBeDefined();
      });
      it('creates file with v3', async () => {
        get.mockReturnValueOnce({
          body: {},
        });
        get.mockReturnValueOnce({
          body: {},
        });
        get.mockReturnValueOnce({
          body: {},
        });
        await gitlab.initRepo('some-repo', 'some-token');
        await gitlab.createBranch('some-branch');
        expect(get.post.mock.calls).toMatchSnapshot();
        expect(get.post.mock.calls[0][1].body.branch_name).toBeDefined();
      });
    });
    describe('getSubDirectories(path)', () => {
      it('should return subdirectories', async () => {
        await initRepo('some/repo', 'token');
        get.mockImplementationOnce(() => ({
          body: [{ type: 'tree', name: 'a' }, { type: 'file', name: 'b' }],
        }));
        const dirList = await gitlab.getSubDirectories('some-path');
        expect(get.mock.calls).toMatchSnapshot();
        expect(dirList).toHaveLength(1);
        expect(dirList).toMatchSnapshot();
      });
    });
    describe('commitFilesToBranch(branchName, files, message, parentBranch)', () => {
      it('creates branch', async () => {
        get.mockReturnValueOnce({ statusCode: 404 });
        await gitlab.commitFilesToBranch('some-branch', [], 'some-message');
      });
      it('does not create branch and updates file', async () => {
        get.mockReturnValueOnce({ statusCode: 200 });
        get.mockReturnValueOnce({
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
        get.mockReturnValueOnce({ statusCode: 200 });
        get.mockReturnValueOnce(Promise.reject({ statusCode: 404 }));
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
  describe('getCommitMessages()', () => {
    it('returns commits messages', async () => {
      get.mockReturnValueOnce({
        body: [
          {
            title: 'foo',
          },
          {
            title: 'bar',
          },
        ],
      });
      const res = await gitlab.getCommitMessages();
      expect(res).toMatchSnapshot();
    });
    it('swallows errors', async () => {
      get.mockImplementationOnce(() => {
        throw new Error('some-error');
      });
      const res = await gitlab.getCommitMessages();
      expect(res).toHaveLength(0);
    });
  });
});
