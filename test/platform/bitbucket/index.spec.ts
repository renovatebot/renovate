import URL from 'url';
import responses from './_fixtures/responses';
import { GotApi, RepoParams } from '../../../lib/platform/common';
import { REPOSITORY_DISABLED } from '../../../lib/constants/error-messages';

describe('platform/bitbucket', () => {
  let bitbucket: typeof import('../../../lib/platform/bitbucket');
  let api: jest.Mocked<GotApi>;
  let hostRules: jest.Mocked<typeof import('../../../lib/util/host-rules')>;
  let GitStorage: jest.Mocked<
    import('../../../lib/platform/git/storage').Storage
  > &
    jest.Mock;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    jest.mock('../../../lib/platform/bitbucket/bb-got-wrapper');
    jest.mock('../../../lib/platform/git/storage');
    jest.mock('../../../lib/util/host-rules');
    hostRules = require('../../../lib/util/host-rules');
    api = require('../../../lib/platform/bitbucket/bb-got-wrapper').api;
    bitbucket = require('../../../lib/platform/bitbucket');
    GitStorage = require('../../../lib/platform/git/storage').Storage;
    GitStorage.mockImplementation(() => ({
      initRepo: jest.fn(),
      cleanRepo: jest.fn(),
      getFileList: jest.fn(),
      branchExists: jest.fn(() => true),
      isBranchStale: jest.fn(() => false),
      setBaseBranch: jest.fn(),
      getBranchLastCommitTime: jest.fn(),
      getAllRenovateBranches: jest.fn(),
      getCommitMessages: jest.fn(),
      getFile: jest.fn(),
      commitFilesToBranch: jest.fn(),
      mergeBranch: jest.fn(),
      deleteBranch: jest.fn(),
      getRepoStatus: jest.fn(),
    }));

    // clean up hostRules
    hostRules.clear();
    hostRules.find.mockReturnValue({
      username: 'abc',
      password: '123',
    });
  });

  afterEach(() => {
    bitbucket.cleanRepo();
  });

  async function mockedGet(path: string) {
    let body = (responses as any)[URL.parse(path).pathname!] || { values: [] };
    if (typeof body === 'function') {
      body = await body();
    }
    return { body };
  }

  async function mocked<T = any>(fn: () => Promise<T>) {
    const oldGet = api.get;
    try {
      api.get = jest.fn().mockImplementation(mockedGet);
      return await fn();
    } finally {
      api.get = oldGet;
    }
  }

  function wrap(prop: string) {
    return (...args: any) => mocked(() => (bitbucket as any)[prop](...args));
  }

  function initRepo(config?: Partial<RepoParams>) {
    return mocked(() =>
      bitbucket.initRepo({
        repository: 'some/repo',
        localDir: '',
        optimizeForDisabled: false,
        ...config,
      })
    );
  }

  describe('initPlatform()', () => {
    it('should throw if no username/password', () => {
      expect(() => {
        bitbucket.initPlatform({} as any);
      }).toThrow();
    });
    it('should throw if wrong endpoint', () => {
      expect(() => {
        bitbucket.initPlatform({
          endpoint: 'endpoint',
          username: 'abc',
          password: '123',
        });
      }).toThrow();
    });
    it('should init', () => {
      expect(
        bitbucket.initPlatform({
          username: 'abc',
          password: '123',
        })
      ).toMatchSnapshot();
    });
  });

  describe('getRepos()', () => {
    it('returns repos', async () => {
      api.get.mockReturnValueOnce({
        body: {
          values: [{ full_name: 'foo/bar' }, { full_name: 'some/repo' }],
        },
      } as any);
      expect(await bitbucket.getRepos()).toEqual(['foo/bar', 'some/repo']);
    });
  });

  describe('initRepo()', () => {
    it('works', async () => {
      expect(await initRepo()).toMatchSnapshot();
    });

    it('throws disabled', async () => {
      expect.assertions(1);
      await expect(
        initRepo({ repository: 'some/empty', optimizeForDisabled: true })
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });
  });

  describe('getRepoForceRebase()', () => {
    it('always return false, since bitbucket does not support force rebase', () => {
      const actual = bitbucket.getRepoForceRebase();
      expect(actual).toBe(false);
    });
  });

  describe('setBaseBranch()', () => {
    it('updates file list', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.setBaseBranch('branch');
        await bitbucket.setBaseBranch();
        expect(api.get.mock.calls).toMatchSnapshot();
      });
    });
  });

  describe('getFileList()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getFileList();
      });
    });
  });

  describe('branchExists()', () => {
    describe('getFileList()', () => {
      it('sends to gitFs', async () => {
        await initRepo();
        await mocked(async () => {
          await bitbucket.branchExists('test');
        });
      });
    });
  });

  describe('isBranchStale()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.isBranchStale('test');
      });
    });
  });

  describe('getBranchPr()', () => {
    const getBranchPr = wrap('getBranchPr');
    it('bitbucket finds PR for branch', async () => {
      await initRepo();
      expect(await getBranchPr('branch')).toMatchSnapshot();
    });
    it('returns null if no PR for branch', async () => {
      await initRepo();
      expect(await getBranchPr('branch_without_pr')).toBeNull();
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
      expect(await getBranchStatus('pending/branch', true)).toBe('pending');
      expect(await getBranchStatus('branch-with-empty-status', true)).toBe(
        'pending'
      );
    });
  });

  describe('getBranchStatusCheck()', () => {
    const getBranchStatusCheck = wrap('getBranchStatusCheck');
    it('works', async () => {
      await initRepo();
      expect(await getBranchStatusCheck('master', null)).toBeNull();
      expect(await getBranchStatusCheck('master', 'foo')).toBe('failed');
      expect(await getBranchStatusCheck('master', 'bar')).toBeNull();
    });
  });

  describe('setBranchStatus()', () => {
    it('posts status', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.setBranchStatus({
          branchName: 'branch',
          context: 'context',
          description: 'description',
          state: 'failed',
          url: 'targetUrl',
        });
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
  });

  describe('getRepoStatus()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getRepoStatus();
      });
    });
  });

  describe('deleteBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.deleteBranch('test');
      });
    });
    it('should handle closing PRs when none exist', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.deleteBranch('some-branch', true);
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
    it('should handle closing PRs when some exist', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.deleteBranch('branch', true);
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
  });

  describe('mergeBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.mergeBranch('test');
      });
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getBranchLastCommitTime('test');
      });
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
          localDir: '',
          optimizeForDisabled: false,
        });
        expect(await bitbucket.findIssue('title')).toBeNull();
      });
    });
  });
  describe('ensureIssue()', () => {
    it('updates existing issues', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.ensureIssue({ title: 'title', body: 'body' });
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
    it('creates new issue', async () => {
      await mocked(async () => {
        await bitbucket.initRepo({
          repository: 'some/empty',
          localDir: '',
          optimizeForDisabled: false,
        });
        await bitbucket.ensureIssue({ title: 'title', body: 'body' });
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.post.mock.calls).toMatchSnapshot();
      });
    });
    it('noop for existing issue', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.ensureIssue({ title: 'title', body: 'content\n' });
        expect(api.get.mock.calls).toMatchSnapshot();
        expect(api.post).toHaveBeenCalledTimes(0);
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
    it('should add the given reviewers to the PR', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.addReviewers(5, ['someuser', 'someotheruser']);
        expect(api.put.mock.calls).toMatchSnapshot();
      });
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

    it('finds pr', async () => {
      await initRepo();
      await mocked(async () => {
        expect(await bitbucket.findPr('branch', 'title')).toMatchSnapshot();
      });
    });
  });

  describe('createPr()', () => {
    it('posts PR', async () => {
      await initRepo();
      api.get.mockReturnValueOnce({
        body: {
          values: [{ uuid: '{1234-5678}' }],
        },
      } as any);
      api.post.mockReturnValueOnce({
        body: { id: 5 },
      } as any);
      const { number } = await bitbucket.createPr({
        branchName: 'branch',
        prTitle: 'title',
        prBody: 'body',
      });
      expect(number).toBe(5);
      expect(api.post.mock.calls).toMatchSnapshot();
    });
  });

  describe('getPr()', () => {
    const getPr = wrap('getPr');
    it('exists', async () => {
      await initRepo();
      expect(await getPr(5)).toMatchSnapshot();
    });

    it('canRebase', async () => {
      expect.assertions(4);
      await initRepo();
      const author = global.gitAuthor;
      try {
        await mocked(async () => {
          expect(await bitbucket.getPr(3)).toMatchSnapshot();

          global.gitAuthor = { email: 'bot@renovateapp.com', name: 'bot' };
          expect(await bitbucket.getPr(5)).toMatchSnapshot();

          global.gitAuthor = { email: 'jane@example.com', name: 'jane' };
          expect(await bitbucket.getPr(5)).toMatchSnapshot();

          expect(api.get.mock.calls).toMatchSnapshot();
        });
      } finally {
        global.gitAuthor = author;
      }
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
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.commitFilesToBranch({
          branchName: 'test',
          files: [],
          message: 'message',
        });
      });
    });
  });

  describe('getFile()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getFile('test.file');
      });
    });
  });

  describe('getCommitMessages()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getCommitMessages();
      });
    });
  });

  describe('getAllRenovateBranches()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getAllRenovateBranches('test');
      });
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await mocked(async () => {
        await bitbucket.getBranchLastCommitTime('test');
      });
    });
  });

  describe('getVulnerabilityAlerts()', () => {
    it('returns empty array', async () => {
      expect(await bitbucket.getVulnerabilityAlerts()).toEqual([]);
    });
  });
});
