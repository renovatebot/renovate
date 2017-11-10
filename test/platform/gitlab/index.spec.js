describe('platform/gitlab', () => {
  let gitlab;
  let get;
  beforeEach(() => {
    // clean up env
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_ENDPOINT;

    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/gitlab/gl-got-wrapper');
    jest.mock('../../../lib/platform/gitlab/helpers');
    gitlab = require('../../../lib/platform/gitlab');
    get = require('../../../lib/platform/gitlab/gl-got-wrapper');
  });

  describe('getRepos', () => {
    function getRepos(...args) {
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
  });

  function initRepo(...args) {
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
  describe('getFileList', () => {
    it('returns empty array if error', async () => {
      await initRepo('some/repo', 'token');
      get.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const files = await gitlab.getFileList();
      expect(files).toEqual([]);
    });
    it('warns if truncated result', async () => {
      await initRepo('some/repo', 'token');
      get.mockImplementationOnce(() => ({
        body: [],
      }));
      const files = await gitlab.getFileList();
      expect(files.length).toBe(0);
    });
    it('caches the result', async () => {
      await initRepo('some/repo', 'token');
      get.mockImplementationOnce(() => ({
        body: [],
      }));
      let files = await gitlab.getFileList();
      expect(files.length).toBe(0);
      files = await gitlab.getFileList();
      expect(files.length).toBe(0);
    });
    it('should return the files matching the fileName', async () => {
      await initRepo('some/repo', 'token');
      get.mockImplementationOnce(() => ({
        body: [
          { type: 'blob', path: 'symlinks/package.json', mode: '120000' },
          { type: 'blob', path: 'package.json' },
          {
            type: 'blob',
            path: 'some-dir/package.json.some-thing-else',
          },
          { type: 'blob', path: 'src/app/package.json' },
          { type: 'blob', path: 'src/otherapp/package.json' },
        ],
      }));
      const files = await gitlab.getFileList();
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
  describe('getAllRenovateBranches()', () => {
    it('exists', () => {
      gitlab.getAllRenovateBranches();
    });
  });
  describe('isBranchStale()', () => {
    it('exists', () => {
      gitlab.isBranchStale();
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
      get.mockReturnValueOnce({
        body: [{ number: 91, source_branch: 'somebranch' }],
      });
      get.mockReturnValueOnce({
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
      });
      get.mockReturnValueOnce({ body: 'foo' });
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
  describe('mergeBranch()', () => {
    it('exists', () => {
      gitlab.mergeBranch();
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
      get.mockReturnValueOnce({
        body: [{ id: 123 }],
      });
      await gitlab.addAssignees(42, ['someuser']);
      expect(get.put.mock.calls).toMatchSnapshot();
    });
    it('should warn if more than one assignee', async () => {
      await initRepo('some/repo', 'token');
      get.mockReturnValueOnce({
        body: [{ id: 123 }],
      });
      await gitlab.addAssignees(42, ['someuser', 'someotheruser']);
      expect(get.put.mock.calls).toMatchSnapshot();
    });
    it('should swallow error', async () => {
      await initRepo('some/repo', 'token');
      get.mockImplementationOnce({});
      await gitlab.addAssignees(42, ['someuser', 'someotheruser']);
      expect(get.put.mock.calls).toHaveLength(0);
    });
  });
  describe('addReviewers(issueNo, reviewers)', () => {
    it('should add the given reviewers to the PR', async () => {
      await initRepo('some/repo', 'token');
      await gitlab.addReviewers(42, ['someuser', 'someotheruser']);
    });
  });
  describe('ensureComment', () => {
    it('exists', async () => {
      await gitlab.ensureComment(42, 'some-subject', 'some\ncontent');
    });
  });
  describe('ensureCommentRemoval', () => {
    it('exists', async () => {
      await gitlab.ensureCommentRemoval(42, 'some-subject');
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
  describe('createPr(branchName, title, body)', () => {
    it('returns the PR', async () => {
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
        null
      );
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
        [],
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
    it('gets the file', async () => {
      get.mockReturnValueOnce({
        body: {
          content: 'foo',
        },
      });
      const res = await gitlab.getFile('some-path');
      expect(res).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      get.mockImplementationOnce(() => Promise.reject({ statusCode: 404 }));
      const res = await gitlab.getFile('some-path', 'some-branch');
      expect(res).toBe(null);
    });
    it('throws error for non-404', async () => {
      get.mockImplementationOnce(() => Promise.reject({ statusCode: 403 }));
      let e;
      try {
        await gitlab.getFile('some-path', 'some-branch');
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
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
