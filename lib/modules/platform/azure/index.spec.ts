import { Readable } from 'node:stream';
import is from '@sindresorhus/is';
import type { IGitApi } from 'azure-devops-node-api/GitApi';
import {
  GitPullRequestMergeStrategy,
  GitStatusState,
  PullRequestStatus,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import { mockDeep } from 'jest-mock-extended';
import { mocked, partial } from '../../../../test/util';
import {
  REPOSITORY_ARCHIVED,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages';
import type { logger as _logger } from '../../../logger';
import type * as _git from '../../../util/git';
import type * as _hostRules from '../../../util/host-rules';
import type { Platform, RepoParams } from '../types';
import { AzurePrVote } from './types';

jest.mock('./azure-got-wrapper');
jest.mock('./azure-helper');
jest.mock('../../../util/git');
jest.mock('../../../util/host-rules', () => mockDeep());
jest.mock('../../../util/sanitize', () =>
  mockDeep({ sanitize: (s: string) => s }),
);
jest.mock('timers/promises');

describe('modules/platform/azure/index', () => {
  let hostRules: jest.Mocked<typeof _hostRules>;
  let azure: Platform;
  let azureApi: jest.Mocked<typeof import('./azure-got-wrapper')>;
  let azureHelper: jest.Mocked<typeof import('./azure-helper')>;
  let git: jest.Mocked<typeof _git>;
  let logger: jest.MockedObject<typeof _logger>;

  beforeEach(async () => {
    // reset module
    jest.resetModules();
    hostRules = jest.requireMock('../../../util/host-rules');
    azure = await import('.');
    azureApi = jest.requireMock('./azure-got-wrapper');
    azureHelper = jest.requireMock('./azure-helper');
    logger = mocked(await import('../../../logger')).logger;
    git = jest.requireMock('../../../util/git');
    git.branchExists.mockReturnValue(true);
    git.isBranchBehindBase.mockResolvedValue(false);
    hostRules.find.mockReturnValue({
      token: 'token',
    });
    await azure.initPlatform({
      endpoint: 'https://dev.azure.com/renovate12345',
      token: 'token',
    });
  });

  // do we need the args?

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
              isDisabled: false,
            },
            {
              name: 'repoDisabled',
              project: {
                name: 'prj1',
              },
              isDisabled: true,
            },
          ]),
        }) as any,
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
        }),
      ).toThrow();
    });

    it('should throw if a username but no password', () => {
      expect.assertions(1);
      expect(() =>
        azure.initPlatform({
          endpoint: 'https://dev.azure.com/renovate12345',
          username: 'user',
        }),
      ).toThrow();
    });

    it('should throw if a password but no username', () => {
      expect.assertions(1);
      expect(() =>
        azure.initPlatform({
          endpoint: 'https://dev.azure.com/renovate12345',
          password: 'pass',
        }),
      ).toThrow();
    });

    it('should init', async () => {
      expect(
        await azure.initPlatform({
          endpoint: 'https://dev.azure.com/renovate12345',
          token: 'token',
        }),
      ).toMatchSnapshot();
    });
  });

  describe('getRepos()', () => {
    it('should return an array of repos', async () => {
      const repos = await getRepos(
        'sometoken',
        'https://dev.azure.com/renovate12345',
      );
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
      expect(repos).toMatchSnapshot();
    });
  });

  function initRepo(args?: Partial<RepoParams> | string) {
    azureApi.gitApi.mockResolvedValueOnce(
      partial<IGitApi>({
        getRepositories: jest.fn().mockResolvedValue([
          {
            name: 'repo',
            id: '1',
            privateRepo: true,
            isFork: false,
            defaultBranch: 'defBr',
            project: {
              name: 'some',
            },
          },
          {
            name: 'repo2',
            project: {
              name: 'prj2',
            },
          },
          {
            name: 'repo3',
            project: {
              name: 'some',
            },
            isDisabled: true,
          },
        ]),
      }),
    );

    if (is.string(args)) {
      return azure.initRepo({
        repository: args,
      });
    }

    return azure.initRepo({
      repository: 'some/repo',
      ...args,
    });
  }

  describe('initRepo', () => {
    it(`should initialise the config for a repo`, async () => {
      const config = await initRepo({
        repository: 'some/repo',
      });
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
      expect(config).toMatchSnapshot();
    });

    it(`throws if repo is disabled`, async () => {
      await expect(
        initRepo({
          repository: 'some/repo3',
        }),
      ).rejects.toThrow(REPOSITORY_ARCHIVED);
    });

    it(`throws if repo is not in repos list`, async () => {
      await expect(
        initRepo({
          repository: 'some/missing',
        }),
      ).rejects.toThrow(REPOSITORY_NOT_FOUND);
    });
  });

  describe('getRepoForceRebase', () => {
    it('should return false', async () => {
      expect(await azure.getRepoForceRebase()).toBeFalse();
    });
  });

  describe('findPr(branchName, prTitle, state, targetBranch)', () => {
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
          }) as any,
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: 'open',
      });
      expect(res).toEqual({
        bodyStruct: {
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        createdAt: undefined,
        number: 1,
        pullRequestId: 1,
        sourceBranch: 'branch-a',
        sourceRefName: 'refs/heads/branch-a',
        state: 'open',
        status: 1,
        targetBranch: 'branch-b',
        targetRefName: 'refs/heads/branch-b',
        title: 'branch a pr',
      });
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
          }) as any,
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: '!open',
      });
      expect(res).toEqual({
        bodyStruct: {
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        createdAt: undefined,
        number: 1,
        pullRequestId: 1,
        sourceBranch: 'branch-a',
        sourceRefName: 'refs/heads/branch-a',
        state: 'merged',
        status: 3,
        targetBranch: 'branch-b',
        targetRefName: 'refs/heads/branch-b',
        title: 'branch a pr',
      });
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
          }) as any,
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: 'closed',
      });
      expect(res).toEqual({
        bodyStruct: {
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        createdAt: undefined,
        number: 1,
        pullRequestId: 1,
        sourceBranch: 'branch-a',
        sourceRefName: 'refs/heads/branch-a',
        state: 'closed',
        status: 2,
        targetBranch: 'branch-b',
        targetRefName: 'refs/heads/branch-b',
        title: 'branch a pr',
      });
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
          }) as any,
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
      });
      expect(res).toEqual({
        bodyStruct: {
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        createdAt: undefined,
        number: 1,
        pullRequestId: 1,
        sourceBranch: 'branch-a',
        sourceRefName: 'refs/heads/branch-a',
        state: 'closed',
        status: 2,
        targetBranch: 'branch-b',
        targetRefName: 'refs/heads/branch-b',
        title: 'branch a pr',
      });
    });

    it('returns pr if found matches targetBranch', async () => {
      azureApi.gitApi.mockResolvedValueOnce(
        partial<IGitApi>({
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
              {
                pullRequestId: 2,
                sourceRefName: 'refs/heads/branch-a',
                targetRefName: 'refs/heads/branch-c',
                title: 'branch a pr',
                status: PullRequestStatus.Active,
              },
            ]),
          getPullRequestCommits: jest.fn().mockReturnValue([]),
        }),
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: 'open',
        targetBranch: 'branch-c',
      });
      expect(res).toEqual({
        bodyStruct: {
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        createdAt: undefined,
        number: 2,
        pullRequestId: 2,
        sourceBranch: 'branch-a',
        sourceRefName: 'refs/heads/branch-a',
        state: 'open',
        status: 1,
        targetBranch: 'branch-c',
        targetRefName: 'refs/heads/branch-c',
        title: 'branch a pr',
      });
    });

    it('returns first pr if found does not match targetBranch', async () => {
      azureApi.gitApi.mockResolvedValueOnce(
        partial<IGitApi>({
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
              {
                pullRequestId: 2,
                sourceRefName: 'refs/heads/branch-a',
                targetRefName: 'refs/heads/branch-c',
                title: 'branch a pr',
                status: PullRequestStatus.Active,
              },
            ]),
          getPullRequestCommits: jest.fn().mockReturnValue([]),
        }),
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
        state: 'open',
        targetBranch: 'branch-d',
      });
      expect(res).toEqual({
        bodyStruct: {
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        createdAt: undefined,
        number: 1,
        pullRequestId: 1,
        sourceBranch: 'branch-a',
        sourceRefName: 'refs/heads/branch-a',
        state: 'open',
        status: 1,
        targetBranch: 'branch-b',
        targetRefName: 'refs/heads/branch-b',
        title: 'branch a pr',
      });
    });

    it('catches errors', async () => {
      azureApi.gitApi.mockResolvedValueOnce(
        partial<IGitApi>({
          getPullRequests: jest.fn().mockRejectedValueOnce(new Error()),
        }),
      );
      const res = await azure.findPr({
        branchName: 'branch-a',
        prTitle: 'branch a pr',
      });
      expect(res).toBeNull();
    });
  });

  describe('getPrList()', () => {
    it('returns empty array', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getPullRequests: jest.fn(() => []),
          }) as any,
      );
      expect(await azure.getPrList()).toEqual([]);
    });
  });

  describe('getBranchPr(branchName, targetBranch)', () => {
    it('should return null if no PR exists', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockResolvedValue(
        partial<IGitApi>({
          getPullRequests: jest.fn().mockResolvedValueOnce([]),
        }),
      );
      const pr = await azure.getBranchPr('somebranch');
      expect(pr).toBeNull();
    });

    it('should return the pr', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockResolvedValue(
        partial<IGitApi>({
          getPullRequests: jest
            .fn()
            .mockResolvedValueOnce([
              {
                pullRequestId: 1,
                sourceRefName: 'refs/heads/branch-a',
                targetRefName: 'refs/heads/branch-b',
                title: 'branch a pr',
                status: 1,
              },
            ])
            .mockResolvedValueOnce([]),
          getPullRequestLabels: jest.fn().mockResolvedValue([]),
        }),
      );
      const pr = await azure.getBranchPr('branch-a', 'branch-b');
      expect(pr).toEqual({
        bodyStruct: {
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        createdAt: undefined,
        labels: [],
        number: 1,
        pullRequestId: 1,
        sourceBranch: 'branch-a',
        sourceRefName: 'refs/heads/branch-a',
        state: 'open',
        status: 1,
        targetBranch: 'branch-b',
        targetRefName: 'refs/heads/branch-b',
        title: 'branch a pr',
      });
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
          }) as any,
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name',
      );
      expect(res).toBe('green');
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
          }) as any,
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name',
      );
      expect(res).toBe('green');
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
          }) as any,
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name',
      );
      expect(res).toBe('red');
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
          }) as any,
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name',
      );
      expect(res).toBe('red');
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
          }) as any,
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name',
      );
      expect(res).toBe('yellow');
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
          }) as any,
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name',
      );
      expect(res).toBe('yellow');
    });

    it('should return yellow if status is unknown', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockResolvedValueOnce(
        partial<IGitApi>({
          getBranch: jest
            .fn()
            .mockResolvedValue({ commit: { commitId: 'abcd1234' } }),
          getStatuses: jest.fn().mockResolvedValue([
            {
              state: -1,
              context: { genre: 'a-genre', name: 'a-name' },
            },
          ]),
        }),
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name',
      );
      expect(res).toBe('yellow');
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
          }) as any,
      );
      const res = await azure.getBranchStatusCheck(
        'somebranch',
        'a-genre/a-name',
      );
      expect(res).toBeNull();
    });
  });

  describe('getBranchStatus(branchName, ignoreTests)', () => {
    it('should pass through success', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [
              {
                state: GitStatusState.Succeeded,
                context: { genre: 'renovate' },
              },
            ]),
          }) as any,
      );
      const res = await azure.getBranchStatus('somebranch', true);
      expect(res).toBe('green');
    });

    it('should not treat internal checks as success', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [
              {
                state: GitStatusState.Succeeded,
                context: { genre: 'renovate' },
              },
            ]),
          }) as any,
      );
      const res = await azure.getBranchStatus('somebranch', false);
      expect(res).toBe('yellow');
    });

    it('should pass through failed', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [{ state: GitStatusState.Error }]),
          }) as any,
      );
      const res = await azure.getBranchStatus('somebranch', true);
      expect(res).toBe('red');
    });

    it('should pass through pending', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => [{ state: GitStatusState.Pending }]),
          }) as any,
      );
      const res = await azure.getBranchStatus('somebranch', true);
      expect(res).toBe('yellow');
    });

    it('should fall back to yellow if no statuses returned', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getBranch: jest.fn(() => ({ commit: { commitId: 'abcd1234' } })),
            getStatuses: jest.fn(() => []),
          }) as any,
      );
      const res = await azure.getBranchStatus('somebranch', true);
      expect(res).toBe('yellow');
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
          }) as any,
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
          }) as any,
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
            })),
            createPullRequestLabel: jest.fn(() => ({})),
          }) as any,
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
            })),
            createPullRequestLabel: jest.fn(() => ({})),
          }) as any,
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

    describe('when usePlatformAutomerge is set', () => {
      it('should create and return a PR object with auto-complete set', async () => {
        await initRepo({ repository: 'some/repo' });
        const prResult = {
          pullRequestId: 456,
          title: 'The Title',
          createdBy: {
            id: '123',
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
            mergeCommitMessage: 'The Title',
          },
        };
        const updateFn = jest.fn().mockResolvedValue(prUpdateResult);
        azureApi.gitApi.mockResolvedValueOnce(
          partial<IGitApi>({
            createPullRequest: jest.fn().mockResolvedValue(prResult),
            createPullRequestLabel: jest.fn().mockResolvedValue({}),
            updatePullRequest: updateFn,
          }),
        );
        const pr = await azure.createPr({
          sourceBranch: 'some-branch',
          targetBranch: 'dev',
          prTitle: 'The Title',
          prBody: 'Hello world',
          labels: ['deps', 'renovate'],
          platformOptions: { usePlatformAutomerge: true },
        });
        expect(updateFn).toHaveBeenCalled();
        expect(pr).toMatchSnapshot();
      });

      it('should only call getMergeMethod once per run', async () => {
        await initRepo({ repository: 'some/repo' });
        const prResult = [
          {
            pullRequestId: 456,
            title: 'The Title',
            createdBy: {
              id: '123',
            },
          },
          {
            pullRequestId: 457,
            title: 'The Second Title',
            createdBy: {
              id: '123',
            },
          },
        ];
        const prUpdateResults = [
          {
            ...prResult[0],
            autoCompleteSetBy: {
              id: prResult[0].createdBy.id,
            },
            completionOptions: {
              squashMerge: true,
              deleteSourceBranch: true,
              mergeCommitMessage: 'The Title',
            },
          },
          {
            ...prResult[1],
            autoCompleteSetBy: {
              id: prResult[1].createdBy.id,
            },
            completionOptions: {
              squashMerge: true,
              deleteSourceBranch: true,
              mergeCommitMessage: 'The Second Title',
            },
          },
        ];
        const updateFn = jest.fn(() =>
          Promise.resolve(prUpdateResults.shift()!),
        );

        azureHelper.getMergeMethod.mockResolvedValueOnce(
          GitPullRequestMergeStrategy.Squash,
        );

        azureApi.gitApi.mockResolvedValue(
          partial<IGitApi>({
            createPullRequest: jest.fn(() =>
              Promise.resolve(prResult.shift()!),
            ),
            createPullRequestLabel: jest.fn().mockResolvedValue({}),
            updatePullRequest: updateFn,
          }),
        );
        await azure.createPr({
          sourceBranch: 'some-branch',
          targetBranch: 'dev',
          prTitle: 'The Title',
          prBody: 'Hello world',
          labels: ['deps', 'renovate'],
          platformOptions: { usePlatformAutomerge: true },
        });

        await azure.createPr({
          sourceBranch: 'some-other-branch',
          targetBranch: 'dev',
          prTitle: 'The Second Title',
          prBody: 'Hello world',
          labels: ['deps', 'renovate'],
          platformOptions: { usePlatformAutomerge: true },
        });

        expect(updateFn).toHaveBeenCalledTimes(2);
        expect(azureHelper.getMergeMethod).toHaveBeenCalledTimes(1);
      });
    });

    it('should create and return an approved PR object', async () => {
      await initRepo({ repository: 'some/repo' });
      const prResult = {
        pullRequestId: 456,
        createdBy: {
          id: 123,
          url: 'user-url',
        },
      };
      const prUpdateResult = {
        reviewerUrl: prResult.createdBy.url,
        vote: AzurePrVote.Approved,
        isFlagged: false,
        isRequired: false,
      };
      const updateFn = jest
        .fn(() => prUpdateResult)
        .mockName('createPullRequestReviewer');
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            createPullRequest: jest.fn(() => prResult),
            createPullRequestLabel: jest.fn(() => ({})),
            createPullRequestReviewer: updateFn,
          }) as any,
      );
      const pr = await azure.createPr({
        sourceBranch: 'some-branch',
        targetBranch: 'dev',
        prTitle: 'The Title',
        prBody: 'Hello world',
        labels: ['deps', 'renovate'],
        platformOptions: { autoApprove: true },
      });
      expect(updateFn).toHaveBeenCalled();
      expect(pr).toMatchSnapshot();
    });
  });

  describe('updatePr(prNo, title, body, platformOptions)', () => {
    it('should update the PR', async () => {
      await initRepo({ repository: 'some/repo' });
      const updatePullRequest = jest.fn();
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            updatePullRequest,
          }) as any,
      );
      await azure.updatePr({
        number: 1234,
        prTitle: 'The New Title',
        prBody: 'Hello world again',
        targetBranch: 'new_base',
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
          }) as any,
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
          }) as any,
      );
      await azure.updatePr({
        number: 1234,
        prTitle: 'The New Title',
        prBody: 'Hello world again',
        state: 'closed',
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
          }) as any,
      );
      await azure.updatePr({
        number: 1234,
        prTitle: 'The New Title',
        prBody: 'Hello world again',
        state: 'open',
      });
      expect(updatePullRequest.mock.calls).toMatchSnapshot();
    });

    it('should re-approve the PR', async () => {
      await initRepo({ repository: 'some/repo' });
      const prResult = {
        pullRequestId: 456,
        createdBy: {
          id: 123,
          url: 'user-url',
        },
      };
      const prUpdateResult = {
        reviewerUrl: prResult.createdBy.url,
        vote: AzurePrVote.Approved,
        isFlagged: false,
        isRequired: false,
      };
      const updateFn = jest.fn(() => prUpdateResult);
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            updatePullRequest: jest.fn(() => prResult),
            createPullRequestReviewer: updateFn,
            getPullRequestById: jest.fn(() => ({
              pullRequestId: prResult.pullRequestId,
              createdBy: prResult.createdBy,
            })),
          }) as any,
      );
      const pr = await azure.updatePr({
        number: prResult.pullRequestId,
        prTitle: 'The Title',
        prBody: 'Hello world',
        platformOptions: { autoApprove: true },
      });
      expect(updateFn).toHaveBeenCalled();
      expect(pr).toMatchSnapshot();
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

    it('passes comment through massageMarkdown', async () => {
      await initRepo({ repository: 'some/repo' });
      const gitApiMock = {
        createThread: jest.fn().mockResolvedValue([{ id: 123 }]),
        getThreads: jest.fn().mockResolvedValue([
          {
            comments: [{ content: 'end-user comment', id: 1 }],
            id: 2,
          },
        ]),
        updateComment: jest.fn().mockResolvedValue({ id: 123 }),
      };
      azureApi.gitApi.mockResolvedValue(partial<IGitApi>(gitApiMock));

      await azure.ensureComment({
        number: 42,
        topic: 'some-subject',
        content:
          'You can manually request rebase by checking the rebase/retry box above.',
      });

      const commentContent = gitApiMock.createThread.mock.calls[0];
      expect(JSON.stringify(commentContent)).not.toContain(
        'checking the rebase/retry box above',
      );
      expect(JSON.stringify(commentContent)).toContain(
        'renaming the PR to start with \\"rebase!\\"',
      );
    });
  });

  describe('ensureCommentRemoval', () => {
    // TODO: fix types #22198
    let gitApiMock: any;

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
      await azure.ensureCommentRemoval({
        type: 'by-topic',
        number: 42,
        topic: 'some-subject',
      });
      expect(gitApiMock.getThreads).toHaveBeenCalledWith('1', 42);
      expect(gitApiMock.updateThread).toHaveBeenCalledWith(
        { status: 4 },
        '1',
        42,
        123,
      );
    });

    it('deletes comment by content if found', async () => {
      await initRepo({ repository: 'some/repo' });
      await azure.ensureCommentRemoval({
        type: 'by-content',
        number: 42,
        content: 'some-content',
      });
      expect(gitApiMock.getThreads).toHaveBeenCalledWith('1', 42);
      expect(gitApiMock.updateThread).toHaveBeenCalledWith(
        { status: 4 },
        '1',
        42,
        124,
      );
    });

    it('comment not found', async () => {
      await initRepo({ repository: 'some/repo' });
      await azure.ensureCommentRemoval({
        type: 'by-topic',
        number: 42,
        topic: 'does-not-exist',
      });
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
          }) as any,
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
          }) as any,
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
          }) as any,
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
          }) as any,
      );
      await azure.addReviewers(123, ['test@bonjour.fr', 'jyc', 'required:def']);
      expect(azureApi.gitApi).toHaveBeenCalledTimes(3);
    });
  });

  describe('massageMarkdown(input)', () => {
    it('returns updated pr body', () => {
      const prBody =
        '\n---\n\n - [ ] <!-- rebase-check --> rebase\n<!--renovate-config-hash:-->' +
        'plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(azure.massageMarkdown(prBody)).toBe(
        'plus also [a link](https://github.com/foo/bar/issues/5)',
      );
    });

    it('returns updated comment content', () => {
      const commentContent =
        'You can manually request rebase by checking the rebase/retry box above.\n\n' +
        'plus also [a link](https://github.com/foo/bar/issues/5)';
      expect(azure.massageMarkdown(commentContent)).toBe(
        'You can manually request rebase by renaming the PR to start with "rebase!".\n\nplus also [a link](https://github.com/foo/bar/issues/5)',
      );
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
          }) as any,
      );
      await azure.setBranchStatus({
        branchName: 'test',
        context: 'test',
        description: 'test',
        state: 'yellow',
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
        '1',
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
          }) as any,
      );
      await azure.setBranchStatus({
        branchName: 'test',
        context: 'renovate/artifact/test',
        description: 'test',
        state: 'green',
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
        '1',
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
              title: 'title',
            })),
            updatePullRequest: updatePullRequestMock,
          }) as any,
      );

      azureHelper.getMergeMethod = jest
        .fn()
        .mockReturnValue(GitPullRequestMergeStrategy.Squash);

      const res = await azure.mergePr({
        branchName: branchNameMock,
        id: pullRequestIdMock,
      });

      expect(updatePullRequestMock).toHaveBeenCalledWith(
        {
          status: PullRequestStatus.Completed,
          lastMergeSourceCommit: lastMergeSourceCommitMock,
          completionOptions: {
            mergeStrategy: GitPullRequestMergeStrategy.Squash,
            deleteSourceBranch: true,
            mergeCommitMessage: 'title',
          },
        },
        '1',
        pullRequestIdMock,
      );
      expect(res).toBeTrue();
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
          }) as any,
      );

      azureHelper.getMergeMethod = jest
        .fn()
        .mockReturnValue(GitPullRequestMergeStrategy.Squash);

      const res = await azure.mergePr({
        branchName: branchNameMock,
        id: pullRequestIdMock,
      });
      expect(res).toBeFalse();
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
          }) as any,
      );
      azureHelper.getMergeMethod = jest
        .fn()
        .mockReturnValue(GitPullRequestMergeStrategy.Squash);

      await azure.mergePr({
        branchName: 'test-branch-1',
        id: 1234,
      });
      await azure.mergePr({
        branchName: 'test-branch-2',
        id: 5678,
      });

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
          }) as any,
      );
      azureHelper.getMergeMethod = jest
        .fn()
        .mockReturnValue(GitPullRequestMergeStrategy.Squash);

      const res = await azure.mergePr({
        branchName: branchNameMock,
        id: pullRequestIdMock,
      });
      expect(getPullRequestByIdMock).toHaveBeenCalledTimes(2);
      expect(res).toBeTrue();
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
          }) as any,
      );
      azureHelper.getMergeMethod = jest
        .fn()
        .mockReturnValue(GitPullRequestMergeStrategy.Squash);
      const res = await azure.mergePr({
        branchName: branchNameMock,
        id: pullRequestIdMock,
      });
      expect(getPullRequestByIdMock).toHaveBeenCalledTimes(
        expectedNumRetries + 1,
      );
      expect(logger.warn).toHaveBeenCalled();
      expect(res).toBeTrue();
    });
  });

  describe('deleteLabel()', () => {
    it('Should delete a label', async () => {
      await initRepo({ repository: 'some/repo' });
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            deletePullRequestLabels: jest.fn(),
          }) as any,
      );
      await azure.deleteLabel(1234, 'rebase');
      expect(azureApi.gitApi.mock.calls).toMatchSnapshot();
    });
  });

  describe('getJsonFile()', () => {
    beforeEach(async () => {
      await initRepo();
    });

    it('returns file content', async () => {
      const data = { foo: 'bar' };
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemContent: jest.fn(() =>
              Promise.resolve(Readable.from(JSON.stringify(data))),
            ),
          }) as any,
      );
      const res = await azure.getJsonFile('file.json');
      expect(res).toEqual(data);
    });

    it('returns file content in json5 format', async () => {
      const json5Data = `
        {
          // json5 comment
          foo: 'bar'
        }
      `;
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemContent: jest.fn(() =>
              Promise.resolve(Readable.from(json5Data)),
            ),
          }) as any,
      );
      const res = await azure.getJsonFile('file.json5');
      expect(res).toEqual({ foo: 'bar' });
    });

    it('returns file content from branch or tag', async () => {
      const data = { foo: 'bar' };
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemContent: jest.fn(() =>
              Promise.resolve(Readable.from(JSON.stringify(data))),
            ),
          }) as any,
      );
      const res = await azure.getJsonFile('file.json', undefined, 'dev');
      expect(res).toEqual(data);
    });

    it('throws on malformed JSON', async () => {
      azureApi.gitApi.mockImplementationOnce(
        () =>
          ({
            getItemContent: jest.fn(() =>
              Promise.resolve(Readable.from('!@#')),
            ),
          }) as any,
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
          }) as any,
      );
      await expect(azure.getJsonFile('file.json')).rejects.toThrow();
    });

    it('supports fetch from another repo', async () => {
      const data = { foo: 'bar' };
      const gitApiMock = {
        getItemContent: jest.fn(() =>
          Promise.resolve(Readable.from(JSON.stringify(data))),
        ),
        getRepositories: jest.fn(() =>
          Promise.resolve([
            { id: '123456', name: 'bar', project: { name: 'foo' } },
          ]),
        ),
      };
      azureApi.gitApi.mockImplementationOnce(() => gitApiMock as any);
      const res = await azure.getJsonFile('file.json', 'foo/bar');
      expect(res).toEqual(data);
      expect(gitApiMock.getItemContent.mock.calls).toMatchSnapshot();
    });

    it('returns null', async () => {
      azureApi.gitApi.mockResolvedValueOnce(
        partial<IGitApi>({
          getRepositories: jest.fn(() => Promise.resolve([])),
        }),
      );
      const res = await azure.getJsonFile('file.json', 'foo/bar');
      expect(res).toBeNull();
    });
  });
});
