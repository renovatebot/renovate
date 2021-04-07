import { Readable } from 'stream';
import is from '@sindresorhus/is';
import {
  GitPullRequestMergeStrategy,
  GitStatusState,
  PullRequestStatus,
} from 'azure-devops-node-api/interfaces/GitInterfaces';
import { logger as _logger } from '../../logger';
import { BranchStatus, PrState } from '../../types';
import * as _git from '../../util/git';
import * as _hostRules from '../../util/host-rules';
import type { Platform, RepoParams } from '../types';

describe('platform/azure', () => {
  let hostRules: jest.Mocked<typeof _hostRules>;
  let azure: Platform;
  let azureApi: jest.Mocked<typeof import('./azure-got-wrapper')>;
  let azureHelper: jest.Mocked<typeof import('./azure-helper')>;
  let git: jest.Mocked<typeof _git>;
  let logger: jest.Mocked<typeof _logger>;
  beforeEach(async () => {
    // reset module
    jest.resetModules();
    jest.mock('./azure-got-wrapper');
    jest.mock('./azure-helper');
    jest.mock('../../util/git');
    jest.mock('../../util/host-rules');
    jest.mock('../../logger');
    jest.mock('delay');
    hostRules = require('../../util/host-rules');
    require('../../util/sanitize').sanitize = jest.fn((input) => input);
    azure = await import('.');
    azureApi = require('./azure-got-wrapper');
    azureHelper = require('./azure-helper');
    logger = (await import('../../logger')).logger as never;
    git = require('../../util/git');
    git.branchExists.mockReturnValue(true);
    git.isBranchStale.mockResolvedValue(false);
    hostRules.find.mockReturnValue({
      token: 'token',
    });
    await azure.initPlatform({
      endpoint: 'https://dev.azure.com/renovate12345',
      token: 'token',
    });
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

  describe('initRepo', () => {
    it(`should initialise the config for a repo`, async () => {
      const config = await initRepo({
        repository: 'some-repo',
      });
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
      expect(config).toMatchSnapshot();
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
                  targetRefName: 'refs/heads/branch-b',
                  title: 'branch a pr',
                  status: PullRequestStatus.Active,
                },
              ]),
            getPullRequestCommits: jest.fn().mockReturnValue([]),
          } as any)
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: PrState.Open,
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
                  targetRefName: 'refs/heads/branch-b',
                  title: 'branch a pr',
                  status: PullRequestStatus.Completed,
                },
              ]),
            getPullRequestCommits: jest.fn().mockReturnValue([]),
          } as any)
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: PrState.NotOpen,
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
                  targetRefName: 'refs/heads/branch-b',
                  title: 'branch a pr',
                  status: PullRequestStatus.Abandoned,
                },
              ]),
            getPullRequestCommits: jest.fn().mockReturnValue([]),
          } as any)
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: PrState.Closed,
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
                  targetRefName: 'refs/heads/branch-b',
                  title: 'branch a pr',
                  status: PullRequestStatus.Abandoned,
                },
              ]),
            getPullRequestCommits: jest.fn().mockReturnValue([]),
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
      const pr = await azure.getBranchPr('somebranch');
      expect(pr).toMatchSnapshot();
    });
  });
  describe('getBranchStatusCheck(branchName, context)', () => {
    it('should return green if status is succeeded', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [
              {
                state: GitStatusState.Succeeded,
                context: { genre: 'a-genre', name: 'a-name' },
              },
            ]),
          } as any)
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name'
      );
      expect(res).toBe(BranchStatus.green);
    });

    it('should return green if status is not applicable', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [
              {
                state: GitStatusState.NotApplicable,
                context: { genre: 'a-genre', name: 'a-name' },
              },
            ]),
          } as any)
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name'
      );
      expect(res).toBe(BranchStatus.green);
    });
    it('should return red if status is failed', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [
              {
                state: GitStatusState.Failed,
                context: { genre: 'a-genre', name: 'a-name' },
              },
            ]),
          } as any)
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name'
      );
      expect(res).toBe(BranchStatus.red);
    });
    it('should return red if context status is error', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [
              {
                state: GitStatusState.Error,
                context: { genre: 'a-genre', name: 'a-name' },
              },
            ]),
          } as any)
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name'
      );
      expect(res).toEqual(BranchStatus.red);
    });
    it('should return yellow if status is pending', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [
              {
                state: GitStatusState.Pending,
                context: { genre: 'a-genre', name: 'a-name' },
              },
            ]),
          } as any)
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name'
      );
      expect(res).toBe(BranchStatus.yellow);
    });
    it('should return yellow if status is not set', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [
              {
                state: GitStatusState.NotSet,
                context: { genre: 'a-genre', name: 'a-name' },
              },
            ]),
          } as any)
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name'
      );
      expect(res).toBe(BranchStatus.yellow);
    });
    it('should return null if status not found', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [
              {
                state: GitStatusState.Pending,
                context: { genre: 'another-genre', name: 'a-name' },
              },
            ]),
          } as any)
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name'
      );
      expect(res).toBeNull();
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
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [{ state: GitStatusState.Succeeded }]),
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
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [{ state: GitStatusState.Error }]),
          } as any)
      );
      const res = await azure.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.red);
    });
    it('should pass through pending', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [{ state: GitStatusState.Pending }]),
          } as any)
      );
      const res = await azure.getBranchStatus('somebranch', []);
      expect(res).toEqual(BranchStatus.yellow);
    });
    it('should fall back to yellow if no statuses returned', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => []),
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
      const pr = await azure.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'master',
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
      const pr = await azure.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'master',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: ['deps', 'renovate'],
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
      const pr = await azure.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'dev',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: ['deps', 'renovate'],
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
      await azure.updatePr({
        number: 1234,
        prTitle: 'The New Title',
        prBody: 'Hello world again',
      });
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
      await azure.updatePr({
        number: 1234,
        prTitle: 'The New Title - autoclose',
      });
      expect(updatePullRequest.mock.calls).toMatchSnapshot();
    });

    it('should close the PR', async () => {
      await initRepo({ repository: 'some/repo' });
      const updatePullRequest = jest.fn();
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            updatePullRequest,
          } as any)
      );
      await azure.updatePr({
        number: 1234,
        prTitle: 'The New Title',
        prBody: 'Hello world again',
        state: PrState.Closed,
      });
      expect(updatePullRequest.mock.calls).toMatchSnapshot();
    });

    it('should reopen the PR', async () => {
      await initRepo({ repository: 'some/repo' });
      const updatePullRequest = jest.fn();
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            updatePullRequest,
          } as any)
      );
      await azure.updatePr({
        number: 1234,
        prTitle: 'The New Title',
        prBody: 'Hello world again',
        state: PrState.Open,
      });
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
      expect(azureApi.gitApi).toHaveBeenCalledTimes(3);
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
      expect(azureApi.gitApi).toHaveBeenCalledTimes(3);
    });
  });

  describe('massageMarkdown(input)', () => {
    it('returns updated pr body', () => {
      const input =
        '<details>https://github.com/foo/bar/issues/5 plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(azure.massageMarkdown(input)).toMatchSnapshot();
    });
  });

  describe('setBranchStatus', () => {
    it('should build and call the create status api properly', async () => {
      await initRepo({ repository: 'some/repo' });
      const createCommitStatusMock = jest.fn();
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            createCommitStatus: createCommitStatusMock,
          } as any)
      );
      await azure.setBranchStatus({
        branchName: 'test',
        context: 'test',
        description: 'test',
        state: BranchStatus.yellow,
        url: 'test.com',
      });
      expect(createCommitStatusMock).toHaveBeenCalledWith(
        {
          context: {
            genre: undefined,
            name: 'test',
          },
          description: 'test',
          state: GitStatusState.Pending,
          targetUrl: 'test.com',
        },
        'abcd1234',
        '1'
      );
    });
    it('should build and call the create status api properly with a complex context', async () => {
      await initRepo({ repository: 'some/repo' });
      const createCommitStatusMock = jest.fn();
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            createCommitStatus: createCommitStatusMock,
          } as any)
      );
      await azure.setBranchStatus({
        branchName: 'test',
        context: 'renovate/artifact/test',
        description: 'test',
        state: BranchStatus.green,
        url: 'test.com',
      });
      expect(createCommitStatusMock).toHaveBeenCalledWith(
        {
          context: {
            genre: 'renovate/artifact',
            name: 'test',
          },
          description: 'test',
          state: GitStatusState.Succeeded,
          targetUrl: 'test.com',
        },
        'abcd1234',
        '1'
      );
    });
  });

  describe('mergePr', () => {
    it('should complete the PR', async () => {
      await initRepo({ repository: 'some/repo' });
      const pullRequestIdMock = 12345;
      const branchNameMock = 'test';
      const lastMergeSourceCommitMock = { commitId: 'abcd1234' };
      const updatePullRequestMock = jest.fn(() => ({
        status: 3,
      }));
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequestById: jest.fn(() => ({
              lastMergeSourceCommit: lastMergeSourceCommitMock,
              targetRefName: 'refs/heads/ding',
            })),
            updatePullRequest: updatePullRequestMock,
          } as any)
      );

      azureHelper.getMergeMethod = jest
        .fn()
        .mockReturnValue(GitPullRequestMergeStrategy.Squash);

      const res = await azure.mergePr(pullRequestIdMock, branchNameMock);

      expect(updatePullRequestMock).toHaveBeenCalledWith(
        {
          status: PullRequestStatus.Completed,
          lastMergeSourceCommit: lastMergeSourceCommitMock,
          completionOptions: {
            mergeStrategy: GitPullRequestMergeStrategy.Squash,
            deleteSourceBranch: true,
          },
        },
        '1',
        pullRequestIdMock
      );
      expect(res).toBe(true);
    });
    it('should return false if the PR does not update successfully', async () => {
      await initRepo({ repository: 'some/repo' });
      const pullRequestIdMock = 12345;
      const branchNameMock = 'test';
      const lastMergeSourceCommitMock = { commitId: 'abcd1234' };
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequestById: jest.fn(() => ({
              lastMergeSourceCommit: lastMergeSourceCommitMock,
            })),
            updatePullRequest: jest
              .fn()
              .mockRejectedValue(new Error(`oh no pr couldn't be updated`)),
          } as any)
      );

      azureHelper.getMergeMethod = jest
        .fn()
        .mockReturnValue(GitPullRequestMergeStrategy.Squash);

      const res = await azure.mergePr(pullRequestIdMock, branchNameMock);
      expect(res).toBe(false);
    });

    it('should cache the mergeMethod for subsequent merges', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementation(
        () =>
          ({
            getPullRequestById: jest.fn(() => ({
              lastMergeSourceCommit: { commitId: 'abcd1234' },
              targetRefName: 'refs/heads/ding',
            })),
            updatePullRequest: jest.fn(),
          } as any)
      );
      azureHelper.getMergeMethod = jest
        .fn()
        .mockReturnValue(GitPullRequestMergeStrategy.Squash);

      await azure.mergePr(1234, 'test-branch-1');
      await azure.mergePr(5678, 'test-branch-2');

      expect(azureHelper.getMergeMethod).toHaveBeenCalledTimes(1);
    });

    it('should refetch the PR if the update response has not yet been set to completed', async () => {
      await initRepo({ repository: 'some/repo' });
      const pullRequestIdMock = 12345;
      const branchNameMock = 'test';
      const lastMergeSourceCommitMock = { commitId: 'abcd1234' };
      const getPullRequestByIdMock = jest.fn(() => ({
        lastMergeSourceCommit: lastMergeSourceCommitMock,
        targetRefName: 'refs/heads/ding',
        status: 3,
      }));
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequestById: getPullRequestByIdMock,
            updatePullRequest: jest.fn(() => ({
              status: 1,
            })),
          } as any)
      );
      azureHelper.getMergeMethod = jest
        .fn()
        .mockReturnValue(GitPullRequestMergeStrategy.Squash);

      const res = await azure.mergePr(pullRequestIdMock, branchNameMock);

      expect(getPullRequestByIdMock).toHaveBeenCalledTimes(2);
      expect(res).toBe(true);
    });

    it('should log a warning after retrying if the PR has still not yet been set to completed', async () => {
      await initRepo({ repository: 'some/repo' });
      const pullRequestIdMock = 12345;
      const branchNameMock = 'test';
      const lastMergeSourceCommitMock = { commitId: 'abcd1234' };
      const expectedNumRetries = 5;
      const getPullRequestByIdMock = jest.fn(() => ({
        lastMergeSourceCommit: lastMergeSourceCommitMock,
        targetRefName: 'refs/heads/ding',
        status: 1,
      }));
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequestById: getPullRequestByIdMock,
            updatePullRequest: jest.fn(() => ({
              status: 1,
            })),
          } as any)
      );
      azureHelper.getMergeMethod = jest
        .fn()
        .mockReturnValue(GitPullRequestMergeStrategy.Squash);

      const res = await azure.mergePr(pullRequestIdMock, branchNameMock);

      expect(getPullRequestByIdMock).toHaveBeenCalledTimes(
        expectedNumRetries + 1
      );
      expect(logger.warn).toHaveBeenCalled();
      expect(res).toBe(true);
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
  describe('getJsonFile()', () => {
    it('returns file content', async () => {
      const data = { foo: 'bar' };
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemContent: jest.fn(() =>
              Promise.resolve(Readable.from(JSON.stringify(data)))
            ),
          } as any)
      );
      const res = await azure.getJsonFile('file.json');
      expect(res).toEqual(data);
    });
    it('throws on malformed JSON', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemContent: jest.fn(() =>
              Promise.resolve(Readable.from('!@#'))
            ),
          } as any)
      );
      await expect(azure.getJsonFile('file.json')).rejects.toThrow();
    });
    it('throws on errors', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemContent: jest.fn(() => {
              throw new Error('some error');
            }),
          } as any)
      );
      await expect(azure.getJsonFile('file.json')).rejects.toThrow();
    });
  });
});
