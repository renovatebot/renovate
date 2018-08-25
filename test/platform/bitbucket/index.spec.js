const URL = require('url');

describe('platform/bitbucket', () => {
  let bitbucket;
  let api;
  let endpoints;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/bitbucket/bb-got-wrapper');
    endpoints = require('../../../lib/util/endpoints');
    api = require('../../../lib/platform/bitbucket/bb-got-wrapper');
    bitbucket = require('../../../lib/platform/bitbucket');

    // clean up endpoints
    endpoints.clear();
    endpoints.update({
      platform: 'bitbucket',
      token: 'token',
    });
  });

  afterEach(() => {
    bitbucket.cleanRepo();
  });

  const pr = {
    id: 5,
    source: { branch: { name: 'branch' } },
    title: 'title',
    summary: { raw: 'summary' },
    state: 'OPEN',
    created_on: '2018-07-02T07:02:25.275030+00:00',
    links: {
      commits: {
        href:
          'https://api.bitbucket.org/2.0/repositories/some/repo/pullrequests/5/commits',
      },
    },
  };
  function notFound() {
    const err = new Error('Not found');
    err.statusCode = 404;
    throw err;
  }

  const responses = {
    '/2.0/repositories/some/repo': {
      is_private: false,
      full_name: 'some/repo',
      owner: { username: 'some' },
      mainbranch: { name: 'master' },
    },
    '/2.0/repositories/some/repo/pullrequests': {
      values: [pr],
    },
    '/2.0/repositories/some/repo/pullrequests/5': pr,
    '/2.0/repositories/some/repo/pullrequests/5/diff': `
      diff --git a/requirements.txt b/requirements.txt
      index 7e08d70..f5283ca 100644
      --- a/requirements.txt
      +++ b/requirements.txt
      @@ -7,7 +7,7 @@ docutils==0.12
      enum34==1.1.6
      futures==3.2.0
      isort==4.3.4
      -jedi==0.11.1
      +jedi==0.12.1
      lazy-object-proxy==1.3.1
      lxml==3.6.0
      mccabe==0.6.1
    `
      .trim()
      .replace(/^\s+/g, ''),
    '/2.0/repositories/some/repo/pullrequests/5/commits': {
      values: [{}],
    },
    '/2.0/repositories/some/repo/refs/branches': {
      values: [
        { name: 'master' },
        { name: 'branch' },
        { name: 'renovate/branch' },
        { name: 'renovate/upgrade' },
      ],
    },
    '/2.0/repositories/some/repo/refs/branches/master': {
      name: 'master',
      target: { hash: 'master_hash' },
    },
    '/2.0/repositories/some/repo/refs/branches/branch': {
      name: 'branch',
      target: {
        hash: 'branch_hash',
        parents: [{ hash: 'master_hash' }],
      },
    },
    '/!api/1.0/repositories/some/repo/directory/master_hash': {
      values: ['foo_folder/foo_file', 'bar_file'],
    },
    '/!api/1.0/repositories/some/repo/directory/branch_hash': notFound,
    '/2.0/repositories/some/repo/src/branch_hash/': {
      values: [
        {
          path: 'foo_folder',
          type: 'commit_directory',
          links: {
            self: {
              href: '/2.0/repositories/some/repo/src/branch_hash/foo_folder/',
            },
          },
        },
        {
          path: 'bar_file',
          type: 'commit_file',
        },
      ],
    },
    '/2.0/repositories/some/repo/src/branch_hash/foo_folder/': {
      values: [
        {
          path: 'foo_folder/foo_file',
          type: 'commit_file',
        },
      ],
    },
    '/2.0/repositories/some/repo/src/branch_hash/bar_file': 'bar_file content',
    '/2.0/repositories/some/repo/src/branch_hash/not_found': notFound,
    '/2.0/repositories/some/repo/src/branch_hash/error': () => {
      throw new Error('Server error');
    },
    '/2.0/repositories/some/repo/commits': {
      values: [...Array(20).keys()].map(i => ({
        message: 'Commit messsage ' + i,
      })),
    },
  };

  async function mockedGet(path) {
    let body = responses[URL.parse(path).pathname] || { values: [] };
    if (typeof body === 'function') {
      body = await body();
    }
    return { body };
  }

  async function mocked(fn) {
    const oldGet = api.get;
    try {
      api.get = jest.fn().mockImplementation(mockedGet);
      return await fn();
    } finally {
      api.get = oldGet;
    }
  }

  function initRepo() {
    return mocked(() =>
      bitbucket.initRepo({
        repository: 'some/repo',
      })
    );
  }

  describe('getRepos()', () => {
    it('returns repos', async () => {
      api.get.mockReturnValueOnce({
        body: {
          values: [{ full_name: 'foo/bar' }, { full_name: 'some/repo' }],
        },
      });
      expect(await bitbucket.getRepos()).toEqual(['foo/bar', 'some/repo']);
    });
  });

  describe('initRepo()', () => {
    it('works', async () => {
      expect(await initRepo()).toMatchSnapshot();
    });
  });

  describe('getRepoForceRebase()', () => {
    it('exists', async () => {
      expect(await bitbucket.getRepoForceRebase()).toBe(false);
    });

    it('always return false, since bitbucket does not support force rebase', () => {
      const actual = bitbucket.getRepoForceRebase();
      const expected = false;
      expect(actual).toBe(expected);
    });
  });

  describe('setBaseBranch()', () => {
    it('exists', () => {
      expect(bitbucket.setBaseBranch).toBeDefined();
    });
  });

  describe('getFileList()', () => {
    const getFileList = br => mocked(() => bitbucket.getFileList(br));
    it('works', async () => {
      await initRepo();
      expect(await getFileList('branch')).toEqual([
        'foo_folder/foo_file',
        'bar_file',
      ]);
    });
    it('uses v1 when possible', async () => {
      await initRepo();
      expect(await getFileList('master')).toEqual([
        'foo_folder/foo_file',
        'bar_file',
      ]);
    });
    it('returns cached result', async () => {
      await initRepo();
      expect(await bitbucket.getFileList('master')).toEqual([
        'foo_folder/foo_file',
        'bar_file',
      ]);
    });
  });

  describe('branchExists()', () => {
    it('returns true if branch exist in repo', async () => {
      api.get.mockImplementationOnce(() => ({ body: { name: 'branch1' } }));
      const actual = await bitbucket.branchExists('branch1');
      const expected = true;
      expect(actual).toBe(expected);
    });

    it('returns false if branch does not exist in repo', async () => {
      api.get.mockImplementationOnce(() => ({ body: { name: 'branch2' } }));
      const actual = await bitbucket.branchExists('branch1');
      const expected = false;
      expect(actual).toBe(expected);
    });

    it('returns false if 404', async () => {
      api.get.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      const actual = await bitbucket.branchExists('branch1');
      const expected = false;
      expect(actual).toBe(expected);
    });
  });

  describe('isBranchStale()', () => {
    it('returns false for same hash', async () => {
      await initRepo();
      const isStale = await mocked(() => bitbucket.isBranchStale('branch'));
      expect(isStale).toBe(false);
    });
  });

  describe('getBranchPr()', () => {
    it('bitbucket finds PR for branch', async () => {
      await initRepo(responses);
      const branch = await mocked(() => bitbucket.getBranchPr('branch'));
      expect(branch).toMatchSnapshot();
    });
    it('returns null if no PR for branch', async () => {
      await initRepo();
      const branch = await mocked(() =>
        bitbucket.getBranchPr('branch_without_pr')
      );
      expect(branch).toBe(null);
    });
  });

  describe('getBranchStatus()', () => {
    it('exists', () => {
      expect(bitbucket.getBranchStatus).toBeDefined();
    });
  });

  describe('getBranchStatusCheck()', () => {
    it('exists', () => {
      expect(bitbucket.getBranchStatusCheck).toBeDefined();
    });
  });

  describe('setBranchStatus()', () => {
    it('exists', () => {
      expect(bitbucket.setBranchStatus).toBeDefined();
    });
  });

  describe('deleteBranch()', () => {
    it('exists', () => {
      expect(bitbucket.deleteBranch).toBeDefined();
    });
  });

  describe('mergeBranch()', () => {
    it('exists', () => {
      expect(bitbucket.mergeBranch).toBeDefined();
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('exists', () => {
      expect(bitbucket.getBranchLastCommitTime).toBeDefined();
    });
  });

  describe('ensureIssue()', () => {
    it('exists', () => {
      expect(bitbucket.ensureIssue).toBeDefined();
    });
  });

  describe('ensureIssueClosing()', () => {
    it('exists', () => {
      expect(bitbucket.ensureIssueClosing).toBeDefined();
    });
  });

  describe('addAssignees()', () => {
    it('exists', () => {
      expect(bitbucket.addAssignees).toBeDefined();
    });
  });

  describe('addReviewers', () => {
    it('exists', () => {
      expect(bitbucket.addReviewers).toBeDefined();
    });
  });

  describe('ensureComment()', () => {
    it('exists', () => {
      expect(bitbucket.ensureComment).toBeDefined();
    });
  });

  describe('ensureCommentRemoval()', () => {
    it('exists', () => {
      expect(bitbucket.ensureCommentRemoval).toBeDefined();
    });
  });

  describe('getPrList()', () => {
    it('exists', () => {
      expect(bitbucket.getPrList).toBeDefined();
    });
  });

  describe('findPr()', () => {
    it('exists', () => {
      expect(bitbucket.findPr).toBeDefined();
    });
  });

  describe('createPr()', () => {
    it('posts PR', async () => {
      await initRepo();
      api.post.mockReturnValueOnce({
        body: { id: 5 },
      });
      const { id } = await bitbucket.createPr('branch', 'title', 'body');
      expect(id).toBe(5);
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });

  describe('getPr()', () => {
    it('exists', () => {
      expect(bitbucket.getPr).toBeDefined();
    });
  });

  describe('getPrFiles()', () => {
    it('exists', () => {
      expect(bitbucket.getPrFiles).toBeDefined();
    });
  });

  describe('updatePr()', () => {
    it('puts PR', async () => {
      await initRepo();
      await bitbucket.updatePr(5, 'title', 'body');
      expect(api.put.mock.calls).toMatchSnapshot();
    });
  });

  describe('mergePr()', () => {
    it('posts Merge', async () => {
      await initRepo();
      await bitbucket.mergePr(5, 'branch');
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });

  describe('commitFilesToBranch()', () => {
    it('exists', () => {
      expect(bitbucket.commitFilesToBranch).toBeDefined();
    });
  });

  describe('getFile()', () => {
    beforeEach(initRepo);
    const getFile = (...args) => mocked(() => bitbucket.getFile(...args));
    it('works', async () => {
      expect(await getFile('bar_file', 'branch')).toBe('bar_file content');
    });
    it('returns null for file not found', async () => {
      expect(await getFile('not_found', 'master')).toBe(null);
    });
    it('returns null for 404', async () => {
      expect(await getFile('not_found', 'branch')).toBe(null);
    });
    it('throws for non 404', async () => {
      await expect(getFile('error', 'branch')).rejects.toBeDefined();
    });
  });

  describe('getCommitMessages()', () => {
    it('works', async () => {
      await initRepo();
      const messages = await mocked(() => bitbucket.getCommitMessages());
      expect(messages).toMatchSnapshot();
    });
  });

  describe('getAllRenovateBranches()', () => {
    it('exists', async () => {
      await initRepo();
      const branches = await mocked(() =>
        bitbucket.getAllRenovateBranches('renovate/')
      );
      expect(branches).toEqual(['renovate/branch', 'renovate/upgrade']);
    });
  });

  describe('getVulnerabilityAlerts()', () => {
    it('returns empty array', async () => {
      const alerts = await bitbucket.getVulnerabilityAlerts();
      expect(alerts).toEqual([]);
    });
  });
});
