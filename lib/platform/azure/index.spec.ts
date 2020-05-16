import is from '@sindresorhus/is';
import { REPOSITORY_DISABLED } from '../../constants/error-messages';
import { BranchStatus } from '../../types';
import * as _hostRules from '../../util/host-rules';
import { Platform, RepoParams } from '../common';

describe('platform/azure', () => {
  let hostRules: jest.Mocked<typeof _hostRules>;
  let azure: Platform;
  let azureApi: jest.Mocked<typeof import('./azure-got-wrapper')>;
  let azureHelper: jest.Mocked<typeof import('./azure-helper')>;
  let GitStorage;
  beforeEach(async () => {
    // reset module
    jest.resetModules();
    jest.mock('./azure-got-wrapper');
    jest.mock('./azure-helper');
    jest.mock('../git/storage');
    jest.mock('../../util/host-rules');
    hostRules = require('../../util/host-rules');
    require('../../util/sanitize').sanitize = jest.fn((input) => input);
    azure = await import('.');
    azureApi = require('./azure-got-wrapper');
    azureHelper = require('./azure-helper');
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
    }));
    hostRules.find.mockReturnValue({
      token: 'token',
    });
    await azure.initPlatform({
      endpoint: 'https://dev.azure.com/renovate12345',
      token: 'token',
    });
  });

  afterEach(async () => {
    await azure.cleanRepo();
  });

  // do we need the args?
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function getRepos(_token: string, _endpoint: string) {
    azureApi.gitApi.mockImplementationOnce(
      () =>
        ({
          getRepositories: jest.fn(() => [
            {
              name: 'repo1',
              project: {
                name: 'prj1',
              },
            },
            {
              name: 'repo2',
              project: {
                name: 'prj1',
              },
            },
          ]),
        } as any)
    );
    return azure.getRepos();
  }

  describe('initPlatform()', () => {
    it('should throw if no endpoint', () => {
      expect.assertions(1);
      expect(() => azure.initPlatform({})).toThrow();
    });
    it('should throw if no token nor a username and password', () => {
      expect.assertions(1);
      expect(() =>
        azure.initPlatform({
          endpoint: 'https://dev.azure.com/renovate12345',
        })
      ).toThrow();
    });
    it('should throw if a username but no password', () => {
      expect.assertions(1);
      expect(() =>
        azure.initPlatform({
          endpoint: 'https://dev.azure.com/renovate12345',
          username: 'user',
        })
      ).toThrow();
    });
    it('should throw if a password but no username', () => {
      expect.assertions(1);
      expect(() =>
        azure.initPlatform({
          endpoint: 'https://dev.azure.com/renovate12345',
          password: 'pass',
        })
      ).toThrow();
    });
    it('should init', async () => {
      expect(
        await azure.initPlatform({
          endpoint: 'https://dev.azure.com/renovate12345',
          token: 'token',
        })
      ).toMatchSnapshot();
    });
  });

  describe('getRepos()', () => {
    it('should return an array of repos', async () => {
      const repos = await getRepos(
        'sometoken',
        'https://dev.azure.com/renovate12345'
      );
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });

  function initRepo(args?: Partial<RepoParams> | string) {
    azureApi.gitApi.mockImplementationOnce(
      () =>
        ({
          getRepositories: jest.fn(() => [
            {
              name: 'some-repo',
              id: '1',
              privateRepo: true,
              isFork: false,
              defaultBranch: 'defBr',
              project: {
                name: 'some-repo',
              },
            },
            {
              name: 'repo2',
              project: {
                name: 'prj2',
              },
            },
          ]),
        } as any)
    );
    azureApi.gitApi.mockImplementationOnce(
      () =>
        ({
          getBranch: jest.fn(() => ({ commit: { commitId: '1234' } })),
        } as any)
    );
    azureHelper.getProjectAndRepo.mockImplementationOnce(() => ({
      project: 'some-repo',
      repo: 'some-repo',
    }));

    if (is.string(args)) {
      return azure.initRepo({
        repository: args,
      } as any);
    }

    return azure.initRepo({
      repository: 'some/repo',
      ...args,
    } as any);
  }

  describe('getRepoStatus()', () => {
    it('exists', async () => {
      await initRepo();
      expect(await azure.getRepoStatus()).toBeUndefined();
    });
  });

  describe('cleanRepo()', () => {
    it('exists', async () => {
      await azure.cleanRepo();
    });
  });

  describe('initRepo', () => {
    it(`should initialise the config for a repo`, async () => {
      const config = await initRepo({
        repository: 'some-repo',
      });
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
      expect(config).toMatchSnapshot();
    });

    it('throws disabled', async () => {
      expect.assertions(1);
      azureHelper.getFile.mockResolvedValueOnce('{ "enabled": false }');
      await expect(
        initRepo({ repository: 'some-repo', optimizeForDisabled: true })
      ).rejects.toThrow(REPOSITORY_DISABLED);
    });
  });

  describe('getRepoForceRebase', () => {
    it('should return false', async () => {
      expect(await azure.getRepoForceRebase()).toBe(false);
    });
  });

  describe('findPr(branchName, prTitle, state)', () => {
    it('returns pr if found it open', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequests: jest
              .fn()
              .mockReturnValue([])
              .mockReturnValueOnce([
                {
                  pullRequestId: 1,
                  sourceRefName: 'refs/heads/branch-a',
                  title: 'branch a pr',
                  state: 'open',
                },
              ]),
            getPullRequestCommits: jest.fn().mockReturnValue([]),
          } as any)
      );
      azureHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementationOnce(
        () =>
          ({
            number: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            state: 'open',
          } as any)
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: 'open',
      });
      expect(res).toMatchSnapshot();
    });
    it('returns pr if found not open', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequests: jest
              .fn()
              .mockReturnValue([])
              .mockReturnValueOnce([
                {
                  pullRequestId: 1,
                  sourceRefName: 'refs/heads/branch-a',
                  title: 'branch a pr',
                  state: 'closed',
                },
              ]),
            getPullRequestCommits: jest.fn().mockReturnValue([]),
          } as any)
      );
      azureHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementationOnce(
        () =>
          ({
            number: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            state: 'closed',
          } as any)
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: '!open',
      });
      expect(res).toMatchSnapshot();
    });
    it('returns pr if found it close', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequests: jest
              .fn()
              .mockReturnValue([])
              .mockReturnValueOnce([
                {
                  pullRequestId: 1,
                  sourceRefName: 'refs/heads/branch-a',
                  title: 'branch a pr',
                  state: 'closed',
                },
              ]),
            getPullRequestCommits: jest.fn().mockReturnValue([]),
          } as any)
      );
      azureHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementationOnce(
        () =>
          ({
            number: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            state: 'closed',
          } as any)
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: 'closed',
      });
      expect(res).toMatchSnapshot();
    });
    it('returns pr if found it all state', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequests: jest
              .fn()
              .mockReturnValue([])
              .mockReturnValueOnce([
                {
                  pullRequestId: 1,
                  sourceRefName: 'refs/heads/branch-a',
                  title: 'branch a pr',
                  state: 'closed',
                },
              ]),
            getPullRequestCommits: jest.fn().mockReturnValue([]),
          } as any)
      );
      azureHelper.getNewBranchName.mockImplementationOnce(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementationOnce(
        () =>
          ({
            number: 1,
            sourceRefName: 'refs/heads/branch-a',
            title: 'branch a pr',
            state: 'closed',
          } as any)
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
      });
      expect(res).toMatchSnapshot();
    });
  });
  describe('getPrList()', () => {
    it('returns empty array', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequests: jest.fn(() => []),
          } as any)
      );
      expect(await azure.getPrList()).toEqual([]);
    });
  });

  describe('getBranchPr(branchName)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            findPr: jest.fn(() => false),
            getPr: jest.fn(() => {
              'myPRName';
            }),
          } as any)
      );
      const pr = await azure.getBranchPr('somebranch');
      expect(pr).toBeNull();
    });
    it('should return the pr', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementation(
        () =>
          ({
            getPullRequests: jest
              .fn()
              .mockReturnValue([])
              .mockReturnValueOnce([
                {
                  pullRequestId: 1,
                  sourceRefName: 'refs/heads/branch-a',
                  title: 'branch a pr',
                  status: 2,
                },
              ]),
            getPullRequestCommits: jest.fn().mockReturnValue([]),
          } as any)
      );
      azureHelper.getNewBranchName.mockImplementation(
        () => 'refs/heads/branch-a'
      );
      azureHelper.getRenovatePRFormat.mockImplementation(
        () =>
          ({
            pullRequestId: 1,
            number: 1,
            head: { ref: 'branch-a' },
            title: 'branch a pr',
            isClosed: false,
          } as any)
      );
      const pr = await azure.getBranchPr('somebranch');
      expect(pr).toMatchSnapshot();
    });
  });

  describe('getBranchStatus(branchName, requiredStatusChecks)', () => {
    it('return success if requiredStatusChecks null', async () => {
      await initRepo('some-repo');
      const res = await azure.getBranchStatus('somebranch', null);
      expect(res).toEqual(BranchStatus.green);
    });
    it('return failed if unsupported requiredStatusChecks', async () => {
      await initRepo('some-repo');
      const res = await azure.getBranchStatus('somebranch', ['foo']);
      expect(res).toEqual(BranchStatus.red);
    });
    it('should pass through success', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ aheadCount: 0 })),
          } as any)
      );
      const res = await azure.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.green);
    });
    it('should pass through failed', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ aheadCount: 123 })),
          } as any)
      );
      const res = await azure.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.yellow);
    });
  });

  describe('getPr(prNo)', () => {
    it('should return null if no prNo is passed', async () => {
      const pr = await azure.getPr(0);
      expect(pr).toBeNull();
    });
    it('should return null if no PR is returned from azure', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequests: jest.fn(() => []),
          } as any)
      );
      const pr = await azure.getPr(1234);
      expect(pr).toBeNull();
    });
    it('should return a pr in the right format', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementation(
        () =>
          ({
            getPullRequests: jest
              .fn()
              .mockReturnValue([])
              .mockReturnValueOnce([
                {
                  pullRequestId: 1234,
                },
              ]),
            getPullRequestLabels: jest
              .fn()
              .mockReturnValue([{ active: true, name: 'renovate' }]),
            getPullRequestCommits: jest.fn().mockReturnValue([
              {
                author: {
                  name: 'renovate',
                },
              },
            ]),
          } as any)
      );
      azureHelper.getRenovatePRFormat.mockImplementation(
        () =>
          ({
            number: 1234,
          } as any)
      );
      const pr = await azure.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
    it('should return a pr thats been modified', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementation(
        () =>
          ({
            getPullRequests: jest
              .fn()
              .mockReturnValue([])
              .mockReturnValueOnce([
                {
                  pullRequestId: 1234,
                },
              ]),
            getPullRequestLabels: jest.fn().mockReturnValue([]),
            getPullRequestCommits: jest.fn().mockReturnValue([
              {
                author: {
                  name: 'renovate',
                },
              },
              {
                author: {
                  name: 'end user',
                },
              },
            ]),
          } as any)
      );
      azureHelper.getRenovatePRFormat.mockImplementation(
        () =>
          ({
            number: 1234,
            isModified: false,
          } as any)
      );
      const pr = await azure.getPr(1234);
      expect(pr).toMatchSnapshot();
    });
  });

  describe('createPr()', () => {
    it('should create and return a PR object', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            createPullRequest: jest.fn(() => ({
              pullRequestId: 456,
              displayNumber: `Pull Request #456`,
            })),
            createPullRequestLabel: jest.fn(() => ({})),
          } as any)
      );
      azureHelper.getRenovatePRFormat.mockImplementation(
        () =>
          ({
            displayNumber: 'Pull Request #456',
            number: 456,
            pullRequestId: 456,
          } as any)
      );
      const pr = await azure.createPr({
        branchName: 'some-branch',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: ['deps', 'renovate'],
      });
      expect(pr).toMatchSnapshot();
    });
    it('should create and return a PR object from base branch', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            createPullRequest: jest.fn(() => ({
              pullRequestId: 456,
              displayNumber: `Pull Request #456`,
            })),
            createPullRequestLabel: jest.fn(() => ({})),
          } as any)
      );
      azureHelper.getRenovatePRFormat.mockImplementation(
        () =>
          ({
            displayNumber: 'Pull Request #456',
            number: 456,
            pullRequestId: 456,
          } as any)
      );
      const pr = await azure.createPr({
        branchName: 'some-branch',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: ['deps', 'renovate'],
        useDefaultBranch: true,
      });
      expect(pr).toMatchSnapshot();
    });
    it('should create and return a PR object with auto-complete set', async () => {
      await initRepo({ repository: 'some/repo' });
      const prResult = {
        pullRequestId: 456,
        displayNumber: `Pull Request #456`,
        createdBy: {
          id: 123,
        },
      };
      const prUpdateResult = {
        ...prResult,
        autoCompleteSetBy: {
          id: prResult.createdBy.id,
        },
        completionOptions: {
          squashMerge: true,
          deleteSourceBranch: true,
        },
      };
      const updateFn = jest
        .fn(() => prUpdateResult)
        .mockName('updatePullRequest');
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            createPullRequest: jest.fn(() => prResult),
            createPullRequestLabel: jest.fn(() => ({})),
            updatePullRequest: updateFn,
          } as any)
      );
      azureHelper.getRenovatePRFormat.mockImplementation((x) => x as any);
      const pr = await azure.createPr({
        branchName: 'some-branch',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: ['deps', 'renovate'],
        useDefaultBranch: false,
        platformOptions: { azureAutoComplete: true },
      });
      expect(updateFn).toHaveBeenCalled();
      expect(pr).toMatchSnapshot();
    });
  });

  describe('updatePr(prNo, title, body)', () => {
    it('should update the PR', async () => {
      await initRepo({ repository: 'some/repo' });
      const updatePullRequest = jest.fn();
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            updatePullRequest,
          } as any)
      );
      await azure.updatePr(1234, 'The New Title', 'Hello world again');
      expect(updatePullRequest.mock.calls).toMatchSnapshot();
    });

    it('should update the PR without description', async () => {
      await initRepo({ repository: 'some/repo' });
      const updatePullRequest = jest.fn();
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            updatePullRequest,
          } as any)
      );
      await azure.updatePr(1234, 'The New Title - autoclose');
      expect(updatePullRequest.mock.calls).toMatchSnapshot();
    });
  });

  describe('ensureComment', () => {
    it('adds comment if missing', async () => {
      await initRepo({ repository: 'some/repo' });
      const gitApiMock = {
        createThread: jest.fn(() => [{ id: 123 }]),
        getThreads: jest.fn().mockReturnValue([
          {
            comments: [{ content: 'end-user comment', id: 1 }],
            id: 2,
          },
        ]),
        updateComment: jest.fn(() => ({ id: 123 })),
      };
      azureApi.gitApi.mockImplementation(() => gitApiMock as any);
      await azure.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(gitApiMock.createThread.mock.calls).toMatchSnapshot();
      expect(gitApiMock.updateComment.mock.calls).toMatchSnapshot();
    });
    it('updates comment if missing', async () => {
      await initRepo({ repository: 'some/repo' });
      const gitApiMock = {
        createThread: jest.fn(() => [{ id: 123 }]),
        getThreads: jest.fn().mockReturnValue([
          {
            comments: [{ content: 'end-user comment', id: 1 }],
            id: 3,
          },
          {
            comments: [{ content: '### some-subject\n\nsome\ncontent', id: 2 }],
            id: 4,
          },
        ]),
        updateComment: jest.fn(() => ({ id: 123 })),
      };
      azureApi.gitApi.mockImplementation(() => gitApiMock as any);
      await azure.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\nnew\ncontent',
      });
      expect(gitApiMock.createThread.mock.calls).toMatchSnapshot();
      expect(gitApiMock.updateComment.mock.calls).toMatchSnapshot();
    });
    it('does nothing if comment exists and is the same', async () => {
      await initRepo({ repository: 'some/repo' });
      const gitApiMock = {
        createThread: jest.fn(() => [{ id: 123 }]),
        getThreads: jest.fn().mockReturnValue([
          {
            comments: [{ content: 'end-user comment', id: 1 }],
            id: 3,
          },
          {
            comments: [{ content: '### some-subject\n\nsome\ncontent', id: 2 }],
            id: 4,
          },
        ]),
        updateComment: jest.fn(() => ({ id: 123 })),
      };
      azureApi.gitApi.mockImplementation(() => gitApiMock as any);
      await azure.ensureComment({
        number: 42,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(gitApiMock.createThread.mock.calls).toMatchSnapshot();
      expect(gitApiMock.updateComment.mock.calls).toMatchSnapshot();
    });
    it('does nothing if comment exists and is the same when there is no topic', async () => {
      await initRepo({ repository: 'some/repo' });
      const gitApiMock = {
        createThread: jest.fn(() => [{ id: 123 }]),
        getThreads: jest.fn().mockReturnValue([
          {
            comments: [{ content: 'some\ncontent', id: 2 }],
            id: 4,
          },
        ]),
        updateComment: jest.fn(() => ({ id: 123 })),
      };
      azureApi.gitApi.mockImplementation(() => gitApiMock as any);
      await azure.ensureComment({
        number: 42,
        topic: null,
        content: 'some\ncontent',
      });
      expect(gitApiMock.createThread.mock.calls).toMatchSnapshot();
      expect(gitApiMock.updateComment.mock.calls).toMatchSnapshot();
    });
  });

  describe('ensureCommentRemoval', () => {
    let gitApiMock;
    beforeEach(() => {
      gitApiMock = {
        getThreads: jest.fn(() => [
          {
            comments: [{ content: '### some-subject\n\nblabla' }],
            id: 123,
          },
          {
            comments: [{ content: 'some-content\n' }],
            id: 124,
          },
        ]),
        updateThread: jest.fn(),
      };
      azureApi.gitApi.mockImplementation(() => gitApiMock);
    });
    it('deletes comment by topic if found', async () => {
      await initRepo({ repository: 'some/repo' });
      await azure.ensureCommentRemoval({ number: 42, topic: 'some-subject' });
      expect(gitApiMock.getThreads).toHaveBeenCalledWith('1', 42);
      expect(gitApiMock.updateThread).toHaveBeenCalledWith(
        { status: 4 },
        '1',
        42,
        123
      );
    });
    it('deletes comment by content if found', async () => {
      await initRepo({ repository: 'some/repo' });
      await azure.ensureCommentRemoval({ number: 42, content: 'some-content' });
      expect(gitApiMock.getThreads).toHaveBeenCalledWith('1', 42);
      expect(gitApiMock.updateThread).toHaveBeenCalledWith(
        { status: 4 },
        '1',
        42,
        124
      );
    });
    it('comment not found', async () => {
      await initRepo({ repository: 'some/repo' });
      await azure.ensureCommentRemoval({ number: 42, topic: 'does-not-exist' });
      expect(gitApiMock.getThreads).toHaveBeenCalledWith('1', 42);
      expect(gitApiMock.updateThread).not.toHaveBeenCalled();
    });
  });

  describe('Assignees', () => {
    it('addAssignees', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementation(
        () =>
          ({
            getRepositories: jest.fn(() => [{ id: '1', project: { id: 2 } }]),
            createThread: jest.fn(() => [{ id: 123 }]),
            getThreads: jest.fn(() => []),
          } as any)
      );
      azureApi.coreApi.mockImplementation(
        () =>
          ({
            getTeams: jest.fn(() => [
              { id: 3, name: 'abc' },
              { id: 4, name: 'def' },
            ]),
            getTeamMembersWithExtendedProperties: jest.fn(() => [
              { identity: { displayName: 'jyc', uniqueName: 'jyc', id: 123 } },
            ]),
          } as any)
      );
      await azure.addAssignees(123, ['test@bonjour.fr', 'jyc', 'def']);
      expect(azureApi.gitApi).toHaveBeenCalledTimes(4);
    });
  });

  describe('Reviewers', () => {
    it('addReviewers', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementation(
        () =>
          ({
            getRepositories: jest.fn(() => [{ id: '1', project: { id: 2 } }]),
            createPullRequestReviewer: jest.fn(),
          } as any)
      );
      azureApi.coreApi.mockImplementation(
        () =>
          ({
            getTeams: jest.fn(() => [
              { id: 3, name: 'abc' },
              { id: 4, name: 'def' },
            ]),
            getTeamMembersWithExtendedProperties: jest.fn(() => [
              { identity: { displayName: 'jyc', uniqueName: 'jyc', id: 123 } },
            ]),
          } as any)
      );
      await azure.addReviewers(123, ['test@bonjour.fr', 'jyc', 'def']);
      expect(azureApi.gitApi).toHaveBeenCalledTimes(4);
    });
  });

  describe('getPrBody(input)', () => {
    it('returns updated pr body', () => {
      const input =
        '<details>https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(azure.getPrBody(input)).toMatchSnapshot();
    });
  });

  describe('Not supported by Azure DevOps (yet!)', () => {
    it('setBranchStatus', async () => {
      const res = await azure.setBranchStatus({
        branchName: 'test',
        context: 'test',
        description: 'test',
        state: BranchStatus.yellow,
        url: 'test',
      });
      expect(res).toBeUndefined();
    });

    it('mergePr', async () => {
      const res = await azure.mergePr(0, undefined);
      expect(res).toBe(false);
    });
  });

  describe('getVulnerabilityAlerts()', () => {
    it('returns empty', async () => {
      const res = await azure.getVulnerabilityAlerts();
      expect(res).toHaveLength(0);
    });
  });

  describe('deleteLabel()', () => {
    it('Should delete a label', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            deletePullRequestLabels: jest.fn(),
          } as any)
      );
      await azure.deleteLabel(1234, 'rebase');
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
    });
  });
});
