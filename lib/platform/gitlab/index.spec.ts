import { GotResponse, Platform } from '..';
import { partial } from '../../../test/util';
import {
  REPOSITORY_ARCHIVED,
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_MIRRORED,
} from '../../constants/error-messages';
import {
  PR_STATE_NOT_OPEN,
  PR_STATE_OPEN,
} from '../../constants/pull-requests';
import { BranchStatus } from '../../types';
import * as _hostRules from '../../util/host-rules';

describe('platform/gitlab', () => {
  let gitlab: Platform;
  let api: jest.Mocked<typeof import('./gl-got-wrapper').api>;
  let hostRules: jest.Mocked<typeof _hostRules>;
  let GitStorage: jest.Mocked<typeof import('../git/storage')> & jest.Mock;
  beforeEach(async () => {
    // reset module
    jest.resetModules();
    jest.resetAllMocks();
    jest.mock('./gl-got-wrapper');
    gitlab = await import('.');
    api = require('./gl-got-wrapper').api;
    jest.mock('../../util/host-rules');
    hostRules = require('../../util/host-rules');
    jest.mock('../git/storage');
    GitStorage = require('../git/storage').Storage;
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
      commitFiles: jest.fn(),
      mergeBranch: jest.fn(),
      deleteBranch: jest.fn(),
      getRepoStatus: jest.fn(),
      getBranchCommit: jest.fn(
        () => '0d9c7726c3d628b7e28af234595cfd20febdbf8e'
      ),
    }));
    hostRules.find.mockReturnValue({
      token: 'abc123',
    });
  });

  afterEach(async () => {
    await gitlab.cleanRepo();
  });

  describe('initPlatform()', () => {
    it(`should throw if no token`, async () => {
      await expect(gitlab.initPlatform({} as any)).rejects.toThrow();
    });
    it(`should throw if auth fails`, async () => {
      // user
      api.get.mockRejectedValueOnce(new Error('403'));
      await expect(
        gitlab.initPlatform({ token: 'some-token', endpoint: undefined })
      ).rejects.toThrow();
    });
    it(`should default to gitlab.com`, async () => {
      // user
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            email: 'a@b.com',
            name: 'Renovate Bot',
          },
        })
      );
      expect(
        await gitlab.initPlatform({ token: 'some-token', endpoint: undefined })
      ).toMatchSnapshot();
    });
    it(`should accept custom endpoint`, async () => {
      // user
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            email: 'a@b.com',
            name: 'Renovate Bot',
          },
        })
      );
      expect(
        await gitlab.initPlatform({
          endpoint: 'https://gitlab.renovatebot.com',
          token: 'some-token',
        })
      ).toMatchSnapshot();
    });
  });

  describe('getRepos', () => {
    function getRepos() {
      // repo info
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              path_with_namespace: 'a/b',
            },
            {
              path_with_namespace: 'c/d',
            },
          ],
        })
      );
      return gitlab.getRepos();
    }
    it('should throw an error if it receives an error', async () => {
      api.get.mockRejectedValueOnce(new Error('getRepos error'));
      await expect(gitlab.getRepos()).rejects.toThrow('getRepos error');
    });
    it('should return an array of repos', async () => {
      const repos = await getRepos();
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });
  function initRepo(args?: any) {
    // projects/${config.repository}
    api.get.mockResolvedValueOnce(
      partial<GotResponse>({
        body: {
          default_branch: 'master',
          http_url_to_repo: 'https://gitlab.com/some/repo.git',
        },
      })
    );
    // getBranchCommit
    // user
    api.get.mockResolvedValueOnce(
      partial<GotResponse>({
        body: {
          email: 'a@b.com',
        },
      })
    );
    if (args) {
      return gitlab.initRepo(args);
    }
    return gitlab.initRepo({
      repository: 'some/repo',
      localDir: '',
      optimizeForDisabled: false,
    });
  }
  describe('getRepoStatus()', () => {
    it('exists', async () => {
      await initRepo();
      await gitlab.getRepoStatus();
    });
  });
  describe('cleanRepo()', () => {
    it('exists', async () => {
      await gitlab.cleanRepo();
    });
  });

  describe('initRepo', () => {
    it(`should throw error if disabled in renovate.json`, async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            default_branch: 'master',
            http_url_to_repo: 'https://gitlab.com/some/repo.git',
          },
        })
      );
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            content: Buffer.from('{"enabled": false}').toString('base64'),
          },
        })
      );
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
          localDir: '',
          optimizeForDisabled: true,
        })
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });
    it(`should escape all forward slashes in project names`, async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: [] })
      );
      await initRepo({ repository: 'some/repo/project', token: 'some-token' });
      expect(api.get.mock.calls).toMatchSnapshot();
    });
    it('should throw an error if receiving an error', async () => {
      api.get.mockRejectedValueOnce(new Error('always error'));
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
          localDir: '',
          optimizeForDisabled: false,
        })
      ).rejects.toThrow('always error');
    });
    it('should throw an error if repository is archived', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: { archived: true } })
      );
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
          localDir: '',
          optimizeForDisabled: false,
        })
      ).rejects.toThrow(REPOSITORY_ARCHIVED);
    });
    it('should throw an error if repository is a mirror', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: { mirror: true } })
      );
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
          localDir: '',
          optimizeForDisabled: false,
        })
      ).rejects.toThrow(REPOSITORY_MIRRORED);
    });
    it('should throw an error if repository access is disabled', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: { repository_access_level: 'disabled' },
        })
      );
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
          localDir: '',
          optimizeForDisabled: false,
        })
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });
    it('should throw an error if MRs are disabled', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: { merge_requests_access_level: 'disabled' },
        })
      );
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
          localDir: '',
          optimizeForDisabled: false,
        })
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });
    it('should throw an error if repository has empty_repo property', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: { empty_repo: true } })
      );
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
          localDir: '',
          optimizeForDisabled: false,
        })
      ).rejects.toThrow(REPOSITORY_EMPTY);
    });
    it('should throw an error if repository is empty', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: { default_branch: null } })
      );
      await expect(
        gitlab.initRepo({
          repository: 'some/repo',
          localDir: '',
          optimizeForDisabled: false,
        })
      ).rejects.toThrow(REPOSITORY_EMPTY);
    });
    it('should fall back if http_url_to_repo is empty', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            default_branch: 'master',
            http_url_to_repo: null,
          },
        })
      );
      await initRepo({ repository: 'some/repo/project', token: 'some-token' });
      expect(api.get.mock.calls).toMatchSnapshot();
    });
  });
  describe('getRepoForceRebase', () => {
    it('should return false', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            default_branch: 'master',
            http_url_to_repo: null,
            merge_method: 'merge',
          },
        })
      );
      await initRepo({ repository: 'some/repo/project', token: 'some-token' });
      expect(await gitlab.getRepoForceRebase()).toBe(false);
    });

    it('should return true', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            default_branch: 'master',
            http_url_to_repo: null,
            merge_method: 'ff',
          },
        })
      );
      await initRepo({ repository: 'some/repo/project', token: 'some-token' });
      expect(await gitlab.getRepoForceRebase()).toBe(true);
    });
  });
  describe('setBaseBranch(branchName)', () => {
    it('sets the base branch', async () => {
      await initRepo();
      await gitlab.setBaseBranch();
      expect(api.get.mock.calls).toMatchSnapshot();
    });
    it('uses default base branch', async () => {
      await initRepo();
      await gitlab.setBaseBranch();
    });
  });
  describe('getFileList()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.getFileList();
    });
  });
  describe('branchExists()', () => {
    describe('getFileList()', () => {
      it('sends to gitFs', async () => {
        await initRepo();
        await gitlab.branchExists('');
      });
    });
  });
  describe('getAllRenovateBranches()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.getAllRenovateBranches('');
    });
  });

  describe('getBranchLastCommitTime()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.getBranchLastCommitTime('');
    });
  });
  describe('isBranchStale()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.isBranchStale('');
    });
  });
  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo();
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          // branchExists
          body: [],
        })
      );
      const pr = await gitlab.getBranchPr('some-branch');
      expect(pr).toBeNull();
    });
    it('should return the PR object', async () => {
      await initRepo();
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              iid: 91,
              source_branch: 'some-branch',
              target_branch: 'master',
              state: 'opened',
            },
          ],
        })
      );
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            iid: 91,
            state: 'opened',
            additions: 1,
            deletions: 1,
            commits: 1,
            source_branch: 'some-branch',
            target_branch: 'master',
            base: {
              sha: '1234',
            },
          },
        })
      );
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: [] })
      );
      // get branch commit
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: [{ status: 'success' }] })
      );
      // get commit statuses
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: 'foo' })
      );
      const pr = await gitlab.getBranchPr('some-branch');
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getBranchStatus(branchName, requiredStatusChecks)', () => {
    it('returns success if requiredStatusChecks null', async () => {
      const res = await gitlab.getBranchStatus('somebranch', null);
      expect(res).toEqual(BranchStatus.green);
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      const res = await gitlab.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual(BranchStatus.red);
    });
    it('returns pending if no results', async () => {
      await initRepo();
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [],
        })
      );
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.yellow);
    });
    it('returns success if all are success', async () => {
      await initRepo();
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ status: 'success' }, { status: 'success' }],
        })
      );
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.green);
    });
    it('returns success if optional jobs fail', async () => {
      await initRepo();
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            { status: 'success' },
            { status: 'failed', allow_failure: true },
          ],
        })
      );
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.green);
    });
    it('returns success if all are optional', async () => {
      await initRepo();
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ status: 'failed', allow_failure: true }],
        })
      );
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.green);
    });
    it('returns failure if any mandatory jobs fails', async () => {
      await initRepo();
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            { status: 'success' },
            { status: 'failed', allow_failure: true },
            { status: 'failed' },
          ],
        })
      );
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.red);
    });
    it('maps custom statuses to yellow', async () => {
      await initRepo();
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ status: 'success' }, { status: 'foo' }],
        })
      );
      const res = await gitlab.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.yellow);
    });
    it('throws repository-changed', async () => {
      expect.assertions(1);
      GitStorage.mockImplementationOnce(() => ({
        initRepo: jest.fn(),
        branchExists: jest.fn(() => Promise.resolve(false)),
        cleanRepo: jest.fn(),
      }));
      await initRepo();
      await expect(gitlab.getBranchStatus('somebranch', [])).rejects.toThrow(
        REPOSITORY_CHANGED
      );
    });
  });
  describe('getBranchStatusCheck', () => {
    beforeEach(() => initRepo());
    it('returns null if no results', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [],
        })
      );
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toBeNull();
    });
    it('returns null if no matching results', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ name: 'context-1', status: 'pending' }],
        })
      );
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toBeNull();
    });
    it('returns status if name found', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            { name: 'context-1', status: 'pending' },
            { name: 'some-context', status: 'success' },
            { name: 'context-3', status: 'failed' },
          ],
        })
      );
      const res = await gitlab.getBranchStatusCheck(
        'somebranch',
        'some-context'
      );
      expect(res).toEqual(BranchStatus.green);
    });
  });
  describe('setBranchStatus', () => {
    it.each([BranchStatus.green, BranchStatus.yellow, BranchStatus.red])(
      'sets branch status yellow',
      async (state) => {
        await initRepo();
        await gitlab.setBranchStatus({
          branchName: 'some-branch',
          context: 'some-context',
          description: 'some-description',
          state,
          url: 'some-url',
        });
        expect(api.post).toHaveBeenCalledTimes(1);
      }
    );
  });
  describe('mergeBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.mergeBranch('branch');
    });
  });
  describe('deleteBranch()', () => {
    it('sends to gitFs', async () => {
      await initRepo();

      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              number: 1,
              source_branch: 'branch-a',
              title: 'branch a pr',
              state: 'opened',
            },
          ],
        })
      );
      await gitlab.deleteBranch('branch', true);
    });
    it('defaults to not closing associated PR', async () => {
      await initRepo();
      await gitlab.deleteBranch('branch2');
    });
  });
  describe('findIssue()', () => {
    it('returns null if no issue', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              iid: 1,
              title: 'title-1',
            },
            {
              iid: 2,
              title: 'title-2',
            },
          ],
        })
      );
      const res = await gitlab.findIssue('title-3');
      expect(res).toBeNull();
    });
    it('finds issue', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              iid: 1,
              title: 'title-1',
            },
            {
              iid: 2,
              title: 'title-2',
            },
          ],
        })
      );
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: { description: 'new-content' },
        })
      );
      const res = await gitlab.findIssue('title-2');
      expect(res).not.toBeNull();
    });
  });
  describe('ensureIssue()', () => {
    it('creates issue', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              iid: 1,
              title: 'title-1',
            },
            {
              iid: 2,
              title: 'title-2',
            },
          ],
        })
      );
      const res = await gitlab.ensureIssue({
        title: 'new-title',
        body: 'new-content',
      });
      expect(res).toEqual('created');
    });
    it('updates issue', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              iid: 1,
              title: 'title-1',
            },
            {
              iid: 2,
              title: 'title-2',
            },
          ],
        })
      );
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: { description: 'new-content' },
        })
      );
      const res = await gitlab.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
      });
      expect(res).toEqual('updated');
    });
    it('skips update if unchanged', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              number: 1,
              title: 'title-1',
            },
            {
              number: 2,
              title: 'title-2',
            },
          ],
        })
      );
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: { description: 'newer-content' },
        })
      );
      const res = await gitlab.ensureIssue({
        title: 'title-2',
        body: 'newer-content',
      });
      expect(res).toBeNull();
    });
  });
  describe('ensureIssueClosing()', () => {
    it('closes issue', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              number: 1,
              title: 'title-1',
            },
            {
              number: 2,
              title: 'title-2',
            },
          ],
        })
      );
      await gitlab.ensureIssueClosing('title-2');
    });
  });
  describe('addAssignees(issueNo, assignees)', () => {
    it('should add the given assignees to the issue', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ id: 123 }],
        })
      );
      await gitlab.addAssignees(42, ['someuser']);
      expect(api.put.mock.calls).toMatchSnapshot();
    });
    it('should warn if more than one assignee', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ id: 123 }],
        })
      );
      await gitlab.addAssignees(42, ['someuser', 'someotheruser']);
      expect(api.put.mock.calls).toMatchSnapshot();
    });
    it('should swallow error', async () => {
      api.get.mockResolvedValueOnce(partial<GotResponse>({}));
      await gitlab.addAssignees(42, ['someuser', 'someotheruser']);
      expect(api.put).toHaveBeenCalledTimes(0);
    });
    it('should add the given assignees to the issue if supported', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ id: 123 }],
        })
      );
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ id: 124 }],
        })
      );
      await gitlab.addAssignees(42, ['someuser', 'someotheruser']);
      expect(api.put.mock.calls).toMatchSnapshot();
    });
  });
  describe('addReviewers(issueNo, reviewers)', () => {
    it('should add the given reviewers to the PR', async () => {
      await gitlab.addReviewers(42, ['someuser', 'someotheruser']);
    });
  });
  describe('ensureComment', () => {
    it('add comment if not found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: [] })
      );
      await gitlab.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.post.mock.calls).toMatchSnapshot();
    });
    it('add updates comment if necessary', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
        })
      );
      await gitlab.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(api.post).toHaveBeenCalledTimes(0);
      expect(api.put).toHaveBeenCalledTimes(1);
      expect(api.put.mock.calls).toMatchSnapshot();
    });
    it('skips comment', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ id: 1234, body: '### some-subject\n\nsome\ncontent' }],
        })
      );
      await gitlab.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(api.post).toHaveBeenCalledTimes(0);
      expect(api.put).toHaveBeenCalledTimes(0);
    });
    it('handles comment with no description', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ id: 1234, body: '!merge' }],
        })
      );
      await gitlab.ensureComment({
        number: 42,
        topic: null,
        content: '!merge',
      });
      expect(api.post).toHaveBeenCalledTimes(0);
      expect(api.put).toHaveBeenCalledTimes(0);
    });
  });
  describe('ensureCommentRemoval', () => {
    it('deletes comment by topic if found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ id: 1234, body: '### some-subject\n\nblablabla' }],
        })
      );
      await gitlab.ensureCommentRemoval({ number: 42, topic: 'some-subject' });
      expect(api.delete).toHaveBeenCalledTimes(1);
    });
    it('deletes comment by content if found', async () => {
      await initRepo({ repository: 'some/repo', token: 'token' });
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [{ id: 1234, body: 'some-body\n' }],
        })
      );
      await gitlab.ensureCommentRemoval({ number: 42, content: 'some-body' });
      expect(api.delete).toHaveBeenCalledTimes(1);
    });
  });
  describe('findPr(branchName, prTitle, state)', () => {
    it('returns true if no title and all state', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              iid: 1,
              source_branch: 'branch-a',
              title: 'branch a pr',
              state: 'opened',
            },
          ],
        })
      );
      const res = await gitlab.findPr({
        branchName: 'branch-a',
      });
      expect(res).toBeDefined();
    });
    it('returns true if not open', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              iid: 1,
              source_branch: 'branch-a',
              title: 'branch a pr',
              state: 'merged',
            },
          ],
        })
      );
      const res = await gitlab.findPr({
        branchName: 'branch-a',
        state: PR_STATE_NOT_OPEN,
      });
      expect(res).toBeDefined();
    });

    it('returns true if open and with title', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              iid: 1,
              source_branch: 'branch-a',
              title: 'branch a pr',
              state: 'opened',
            },
          ],
        })
      );
      const res = await gitlab.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: PR_STATE_OPEN,
      });
      expect(res).toBeDefined();
    });

    it('returns true with title', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: [
            {
              iid: 1,
              source_branch: 'branch-a',
              title: 'branch a pr',
              state: 'opened',
            },
          ],
        })
      );
      const res = await gitlab.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
      });
      expect(res).toBeDefined();
    });
  });
  describe('createPr(branchName, title, body)', () => {
    it('returns the PR', async () => {
      api.post.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            id: 1,
            iid: 12345,
          },
        })
      );
      const pr = await gitlab.createPr({
        branchName: 'some-branch',
        prTitle: 'some-title',
        prBody: 'the-body',
        labels: null,
      });
      expect(pr).toMatchSnapshot();
      expect(api.post.mock.calls).toMatchSnapshot();
    });
    it('uses default branch', async () => {
      api.post.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            id: 1,
            iid: 12345,
          },
        })
      );
      const pr = await gitlab.createPr({
        branchName: 'some-branch',
        prTitle: 'some-title',
        prBody: 'the-body',
        labels: [],
        useDefaultBranch: true,
      });
      expect(pr).toMatchSnapshot();
      expect(api.post.mock.calls).toMatchSnapshot();
    });
    it('auto-accepts the MR when requested', async () => {
      api.post.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            id: 1,
            iid: 12345,
          },
        })
      );
      await gitlab.createPr({
        branchName: 'some-branch',
        prTitle: 'some-title',
        prBody: 'the-body',
        labels: [],
        useDefaultBranch: true,
        platformOptions: {
          azureAutoComplete: false,
          statusCheckVerify: false,
          gitLabAutomerge: true,
        },
      });
      // expect(api.post.mock.calls).toMatchSnapshot();
      expect(api.put.mock.calls).toMatchSnapshot();
    });
  });
  describe('getPr(prNo)', () => {
    it('returns the PR', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            id: 1,
            iid: 12345,
            description: 'a merge request',
            state: 'merged',
            merge_status: 'cannot_be_merged',
            diverged_commits_count: 5,
            source_branch: 'some-branch',
            target_branch: 'master',
          },
        })
      );
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            commit: {},
          },
        })
      );
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
    });
    it('returns the mergeable PR', async () => {
      await initRepo();
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            id: 1,
            iid: 12345,
            description: 'a merge request',
            state: 'open',
            diverged_commits_count: 5,
            source_branch: 'some-branch',
            target_branch: 'master',
          },
        })
      );
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: [{ status: 'success' }] })
      ); // get commit statuses
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({ body: { commit: null } })
      ); // check last commit author
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
    });
    it('returns the PR with nonexisting branch', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            id: 1,
            iid: 12345,
            description: 'a merge request',
            state: 'open',
            merge_status: 'cannot_be_merged',
            diverged_commits_count: 2,
            source_branch: 'some-branch',
            target_branch: 'master',
          },
        })
      );
      api.get.mockRejectedValueOnce({
        statusCode: 404,
      });
      const pr = await gitlab.getPr(12345);
      expect(pr).toMatchSnapshot();
    });
  });
  describe('updatePr(prNo, title, body)', () => {
    jest.resetAllMocks();
    it('updates the PR', async () => {
      await gitlab.updatePr(1, 'title', 'body');
      expect(api.put.mock.calls.length).toEqual(1);
    });
  });
  describe('mergePr(pr)', () => {
    jest.resetAllMocks();
    it('merges the PR', async () => {
      await gitlab.mergePr(1, undefined);
      expect(api.put.mock.calls.length).toEqual(1);
    });
  });
  const prBody = `https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5

  Pull Requests are the best, here are some PRs.

  ## Open

These updates have all been created already. Click a checkbox below to force a retry/rebase of any.

 - [ ] <!-- rebase-branch=renovate/major-got-packages -->[build(deps): update got packages (major)](../pull/2433) (\`gh-got\`, \`gl-got\`, \`got\`)
`;
  describe('getPrBody(input)', () => {
    it('returns updated pr body', () => {
      expect(gitlab.getPrBody(prBody)).toMatchSnapshot();
    });
  });
  describe('getFile()', () => {
    it('sends to gitFs', async () => {
      await initRepo();
      await gitlab.getFile('');
    });
  });
  describe('commitFiles()', () => {
    it('sends to gitFs', async () => {
      expect.assertions(1);
      await initRepo();
      await gitlab.commitFiles({
        branchName: 'some-branch',
        files: [{ name: 'SomeFile', contents: 'Some Content' }],
        message: '',
      });
      expect(api.get.mock.calls).toMatchSnapshot();
    });
  });
  describe('getCommitMessages()', () => {
    it('passes to git', async () => {
      await initRepo();
      await gitlab.getCommitMessages();
    });
  });
  describe('getVulnerabilityAlerts()', () => {
    it('returns empty', async () => {
      const res = await gitlab.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
    });
  });
  describe('deleteLabel(issueNo, label)', () => {
    it('should delete the label', async () => {
      api.get.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            id: 1,
            iid: 12345,
            description: 'a merge request',
            state: 'merged',
            merge_status: 'cannot_be_merged',
            diverged_commits_count: 5,
            source_branch: 'some-branch',
            labels: ['foo', 'renovate', 'rebase'],
          },
        })
      );
      api.put.mockResolvedValueOnce(
        partial<GotResponse>({
          body: {
            commit: {},
          },
        })
      );
      await gitlab.deleteLabel(42, 'rebase');
      expect(api.put.mock.calls).toMatchSnapshot();
    });
  });
});
