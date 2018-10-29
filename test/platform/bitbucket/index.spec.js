const URL = require('url');
const responses = require('../../_fixtures/bitbucket/responses');

function streamToString(stream) {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(resolve => {
    const chunks = [];
    stream.on('data', chunk => {
      chunks.push(chunk.toString());
    });
    stream.on('end', () => {
      resolve(chunks.join(''));
    });
    stream.resume();
  });
}

describe('platform/bitbucket', () => {
  let bitbucket;
  let api;
  let hostRules;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/bitbucket/bb-got-wrapper');
    hostRules = require('../../../lib/util/host-rules');
    api = require('../../../lib/platform/bitbucket/bb-got-wrapper');
    bitbucket = require('../../../lib/platform/bitbucket');

    // clean up hostRules
    hostRules.clear();
    hostRules.update({
      platform: 'bitbucket',
      token: 'token',
    });
  });

  afterEach(() => {
    bitbucket.cleanRepo();
  });

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

  function wrap(prop) {
    return (...args) => mocked(() => bitbucket[prop](...args));
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
    it('always return false, since bitbucket does not support force rebase', () => {
      const actual = bitbucket.getRepoForceRebase();
      const expected = false;
      expect(actual).toBe(expected);
    });
  });

  describe('setBaseBranch()', () => {
    it('updates file list', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.setBaseBranch('branch');
        expect(api.get.mock.calls).toMatchSnapshot();
      });
    });
  });

  describe('getFileList()', () => {
    const getFileList = wrap('getFileList');
    it('works', async () => {
      await initRepo();
      expect(await getFileList('branch')).toEqual([
        'foo_folder/foo_file',
        'bar_file',
      ]);
    });
    it('returns cached result', async () => {
      await initRepo();
      expect(await getFileList('branch')).toEqual([
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
    const isBranchStale = wrap('isBranchStale');
    it('returns false for same hash', async () => {
      await initRepo();
      expect(await isBranchStale('branch')).toBe(false);
    });
  });

  describe('getBranchPr()', () => {
    const getBranchPr = wrap('getBranchPr');
    it('bitbucket finds PR for branch', async () => {
      await initRepo(responses);
      expect(await getBranchPr('branch')).toMatchSnapshot();
    });
    it('returns null if no PR for branch', async () => {
      await initRepo();
      expect(await getBranchPr('branch_without_pr')).toBe(null);
    });
  });

  describe('getBranchStatus()', () => {
    const getBranchStatus = wrap('getBranchStatus');
    it('works', async () => {
      await initRepo();
      expect(await getBranchStatus('master', null)).toBe('success');
      expect(await getBranchStatus('master', ['foo'])).toBe('failed');
      expect(await getBranchStatus('master', true)).toBe('failed');
      expect(await getBranchStatus('branch', true)).toBe('success');
    });
  });

  describe('getBranchStatusCheck()', () => {
    const getBranchStatusCheck = wrap('getBranchStatusCheck');
    it('works', async () => {
      await initRepo();
      expect(await getBranchStatusCheck('master', null)).toBe(null);
      expect(await getBranchStatusCheck('master', 'foo')).toBe('failed');
      expect(await getBranchStatusCheck('master', 'bar')).toBe(null);
    });
  });

  describe('setBranchStatus()', () => {
    it('posts status', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.setBranchStatus(
          'branch',
          'context',
          'description',
          'failed',
          'targetUrl'
        );
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
  });

  describe('getRepoStatus()', () => {
    it('exists', async () => {
      expect(await bitbucket.getRepoStatus()).toEqual({});
    });
  });

  describe('deleteBranch()', () => {
    it('exists', () => {
      expect(bitbucket.deleteBranch).toBeDefined();
    });
  });

  describe('mergeBranch()', () => {
    it('throws', async () => {
      await expect(bitbucket.mergeBranch()).rejects.toBeDefined();
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('exists', () => {
      expect(bitbucket.getBranchLastCommitTime).toBeDefined();
    });
  });

  describe('findIssue()', () => {
    it('does not throw', async () => {
      await initRepo();
      await mocked(async () => {
        expect(await bitbucket.findIssue('title')).toMatchSnapshot();
        expect(api.get.mock.calls).toMatchSnapshot();
      });
    });
    it('returns null if no issues', async () => {
      await mocked(async () => {
        await bitbucket.initRepo({
          repository: 'some/empty',
        });
        expect(await bitbucket.findIssue('title')).toBeNull();
      });
    });
  });
  describe('ensureIssue()', () => {
    it('updates existing issues', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.ensureIssue('title', 'body');
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
    it('creates new issue', async () => {
      await mocked(async () => {
        await bitbucket.initRepo({
          repository: 'some/empty',
        });
        await bitbucket.ensureIssue('title', 'body');
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
    it('noop for existing issue', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.ensureIssue('title', 'content\n');
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.post.mock.calls).toHaveLength(0);
      });
    });
  });

  describe('ensureIssueClosing()', () => {
    it('does not throw', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.ensureIssueClosing('title');
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.delete.mock.calls).toMatchSnapshot();
      });
    });
  });

  describe('addAssignees()', () => {
    it('does not throw', async () => {
      await bitbucket.addAssignees(3, ['some']);
    });
  });

  describe('addReviewers', () => {
    it('does not throw', async () => {
      await bitbucket.addReviewers(5, ['some']);
    });
  });

  describe('ensureComment()', () => {
    it('does not throw', async () => {
      await bitbucket.ensureComment(3, 'topic', 'content');
    });
  });

  describe('ensureCommentRemoval()', () => {
    it('does not throw', async () => {
      await bitbucket.ensureCommentRemoval(3, 'topic');
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
    const getPr = wrap('getPr');
    it('exists', async () => {
      await initRepo();
      expect(await getPr(5)).toMatchSnapshot();
    });
  });

  describe('getPrFiles()', () => {
    const getPrFiles = wrap('getPrFiles');
    it('returns diff files', async () => {
      await initRepo();
      expect(await getPrFiles(5)).toMatchSnapshot();
    });
  });

  describe('getPrBody()', () => {
    it('returns diff files', () => {
      expect(
        bitbucket.getPrBody(
          '<details><summary>foo</summary>bar</details>text<details>'
        )
      ).toMatchSnapshot();
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
    it('posts files', async () => {
      await initRepo();
      const files = [
        {
          name: 'package.json',
          contents: 'hello world',
        },
      ];
      await mocked(async () => {
        await bitbucket.commitFilesToBranch('branch', files, 'message');
        expect(api.post.mock.calls).toHaveLength(1);
        const { body } = api.post.mock.calls[0][1];
        const content = (await streamToString(body)).split(
          '--' + body.getBoundary()
        );
        expect(content).toMatchSnapshot();
      });
    });
  });

  describe('getFile()', () => {
    beforeEach(initRepo);
    const getFile = wrap('getFile');
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
    const getCommitMessages = wrap('getCommitMessages');
    it('works', async () => {
      await initRepo();
      expect(await getCommitMessages()).toMatchSnapshot();
    });
  });

  describe('getAllRenovateBranches()', () => {
    const getAllRenovateBranches = wrap('getAllRenovateBranches');
    it('retuns filtered branches', async () => {
      await initRepo();
      expect(await getAllRenovateBranches('renovate/')).toEqual([
        'renovate/branch',
        'renovate/upgrade',
      ]);
    });
  });

  describe('getBranchLastCommitTime()', () => {
    const getBranchLastCommitTime = wrap('getBranchLastCommitTime');
    it('returns last commit time', async () => {
      await initRepo();
      expect(await getBranchLastCommitTime('renovate/foo')).toBeDefined();
    });
  });

  describe('getVulnerabilityAlerts()', () => {
    it('returns empty array', async () => {
      expect(await bitbucket.getVulnerabilityAlerts()).toEqual([]);
    });
  });
});
