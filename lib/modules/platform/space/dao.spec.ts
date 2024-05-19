import { expect } from '@jest/globals';
import { hashBody } from '../pr-body';
import type { SpaceClient } from './client';
import { FindPRConfigPredicate, SpaceDao } from './dao';
import type {
  SpaceChannelItemRecord,
  SpaceMergeRequestRecord,
  SpaceRepositoryBasicInfo,
  SpaceRepositoryDetails,
} from './types';

jest.mock('./client');

describe('modules/platform/space/dao', () => {
  const mockRepository = { getAll: jest.fn(), getByName: jest.fn() };

  const mockJobs = { getAll: jest.fn() };

  const mockCodeReviewWrite = { create: jest.fn() };
  const mockCodeReviewRead = {
    find: jest.fn(),
    getMessages: jest.fn(),
    getByCodeReviewNumber: jest.fn(),
  };
  const mockSpaceClient: jest.Mocked<SpaceClient> = {
    repository: mockRepository as any,
    jobs: mockJobs as any,
    codeReview: {
      write: mockCodeReviewWrite as any,
      read: mockCodeReviewRead as any,
    },
  };

  const dao = new SpaceDao(mockSpaceClient);

  describe('findRepositories()', () => {
    it('should find all repositories', async () => {
      const repo1: SpaceRepositoryBasicInfo = {
        projectKey: 'project1',
        repository: 'repo1',
      };

      const repo2: SpaceRepositoryBasicInfo = {
        projectKey: 'project2',
        repository: 'repo2',
      };

      mockRepository.getAll.mockReturnValueOnce([repo1, repo2]);
      expect(await dao.findRepositories()).toEqual([
        `${repo1.projectKey}/${repo1.repository}`,
        `${repo2.projectKey}/${repo2.repository}`,
      ]);
    });
  });

  describe('getRepositoryInfo()', () => {
    it('should find all repositories', async () => {
      const projectKey = 'my-project';
      const repository = 'my-repo';

      const result: SpaceRepositoryDetails = {
        name: repository,
        description: 'description',
      };
      mockRepository.getByName.mockReturnValueOnce(result);
      expect(await dao.getRepositoryInfo(projectKey, repository)).toEqual(
        result,
      );
      expect(mockRepository.getByName).toHaveBeenCalledWith(
        projectKey,
        repository,
      );
    });
  });

  describe('createMergeRequest()', () => {
    it('should create a merge request', async () => {
      const projectKey = 'my-project';
      const repository = 'my-repo';
      const sourceBranch = 'my-feature-branch';
      const targetBranch = 'my-main-branch';
      const title = 'my awesome pr';
      const description = 'please merge it, its awesome';

      const response: SpaceMergeRequestRecord = {
        id: '123',
        number: 1,
        title,
        state: 'Opened',
        branchPairs: [{ sourceBranch, targetBranch }],
        description,
      };
      mockCodeReviewWrite.create.mockReturnValueOnce(response);

      expect(
        await dao.createMergeRequest(projectKey, repository, {
          sourceBranch,
          targetBranch,
          prTitle: title,
          prBody: description,
        }),
      ).toEqual({
        bodyStruct: {
          hash: hashBody(description),
        },
        number: 1,
        sourceBranch,
        targetBranch,
        state: 'open',
        title,
      });
      expect(mockCodeReviewWrite.create).toHaveBeenCalledWith(projectKey, {
        repository,
        sourceBranch,
        targetBranch,
        title,
        description,
      });
    });
  });

  describe('findAllMergeRequests()', () => {
    it('should find all merge requests', async () => {
      const projectKey = 'my-project';
      const repository = 'my-repo';
      const sourceBranch = 'my-feature-branch';
      const targetBranch = 'my-main-branch';
      const message1 = 'message1';
      const message2 = 'message2';

      const pr1: SpaceMergeRequestRecord = {
        id: '123',
        number: 1,
        title: 'my awesome pr',
        state: 'Opened',
        branchPairs: [{ sourceBranch, targetBranch }],
        description: 'please merge it, its awesome',
      };

      const pr2: SpaceMergeRequestRecord = {
        id: '456',
        number: 2,
        title: 'another pr',
        state: 'Opened',
        branchPairs: [{ sourceBranch, targetBranch }],
        description: 'another description',
      };

      mockCodeReviewRead.find.mockReturnValueOnce([pr1, pr2]);

      mockMergeRequestBody(projectKey, pr1.id, pr1.number, message1);
      mockMergeRequestBody(projectKey, pr2.id, pr2.number, message2);

      expect(await dao.findAllMergeRequests(projectKey, repository)).toEqual([
        {
          bodyStruct: {
            hash: hashBody(message1),
          },
          number: pr1.number,
          sourceBranch,
          targetBranch,
          state: 'open',
          title: pr1.title,
        },
        {
          bodyStruct: {
            hash: hashBody(message2),
          },
          number: pr2.number,
          sourceBranch,
          targetBranch,
          state: 'open',
          title: pr2.title,
        },
      ]);
    });
  });

  describe('findMergeRequest()', () => {
    it('should find latest found merge request', async () => {
      const projectKey = 'my-project';
      const repository = 'my-repo';
      const message1 = 'message1';
      const sourceBranch = 'my-feature-branch';
      const targetBranch = 'my-main-branch';

      const pr1: SpaceMergeRequestRecord = {
        id: '123',
        number: 1,
        title: 'my awesome pr',
        state: 'Opened',
        branchPairs: [{ sourceBranch, targetBranch }],
        description: 'please merge it, its awesome',
      };

      const pr2: SpaceMergeRequestRecord = {
        id: '456',
        number: 2,
        title: 'another pr',
        state: 'Opened',
        branchPairs: [{ sourceBranch, targetBranch }],
        description: 'another description',
      };

      mockCodeReviewRead.find.mockReturnValueOnce([pr2, pr1]);

      mockMergeRequestBody(projectKey, pr1.id, pr1.number, message1);

      expect(
        await dao.findMergeRequest(projectKey, repository, {
          branchName: 'my-feature-branch',
        }),
      ).toEqual({
        bodyStruct: {
          hash: hashBody(message1),
        },
        number: pr1.number,
        sourceBranch,
        targetBranch,
        state: 'open',
        title: pr1.title,
      });

      expect(mockCodeReviewRead.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMergeRequest()', () => {
    it('should get merge request by number', async () => {
      const projectKey = 'my-project';
      const codeReviewNumber = 10;
      const message1 = 'message1';
      const sourceBranch = 'my-feature-branch';
      const targetBranch = 'my-main-branch';

      const pr: SpaceMergeRequestRecord = {
        id: '123',
        number: codeReviewNumber,
        title: 'my awesome pr',
        state: 'Opened',
        branchPairs: [{ sourceBranch, targetBranch }],
        description: 'please merge it, its awesome',
      };

      mockCodeReviewRead.getByCodeReviewNumber.mockReturnValueOnce(pr);

      mockMergeRequestBody(projectKey, pr.id, pr.number, message1);

      expect(await dao.getMergeRequest(projectKey, codeReviewNumber)).toEqual({
        bodyStruct: {
          hash: hashBody(message1),
        },
        number: pr.number,
        sourceBranch,
        targetBranch,
        state: 'open',
        title: pr.title,
      });
    });
  });

  describe('findDefaultBranch()', () => {
    const projectKey = 'my-project';
    const repository = 'my-repo';
    const defaultBranch = 'main';

    it('should find default branch', async () => {
      const result: SpaceRepositoryDetails = {
        name: repository,
        description: 'description',
        defaultBranch: {
          head: `refs/heads/${defaultBranch}`,
          ref: 'HEAD',
        },
      };

      mockRepository.getByName.mockReturnValueOnce(result);

      expect(await dao.findDefaultBranch(projectKey, repository)).toEqual(
        defaultBranch,
      );
      expect(mockRepository.getByName).toHaveBeenCalledWith(
        projectKey,
        repository,
      );
    });

    it('should fall back default branch to main', async () => {
      const result: SpaceRepositoryDetails = {
        name: repository,
        description: 'description',
        defaultBranch: {
          head: `bla`,
          ref: 'HEAD',
        },
      };

      mockRepository.getByName.mockReturnValueOnce(result);

      expect(await dao.findDefaultBranch(projectKey, repository)).toBe('main');
      expect(mockRepository.getByName).toHaveBeenCalledWith(
        projectKey,
        repository,
      );
    });
  });

  describe('FindPRConfigPredicate.test()', () => {
    const sourceBranch = 'my-feature-branch';
    const targetBranch = 'my-main-branch';

    it('should return false for state Opened and allButOpen', async () => {
      const predicate = new FindPRConfigPredicate({
        branchName: sourceBranch,
        state: '!open',
      });
      expect(
        await predicate.test({
          id: '1',
          number: 1,
          title: 'title',
          state: 'Opened',
          branchPairs: [{ sourceBranch, targetBranch }],
        }),
      ).toBe(false);
    });

    it('should return false when more than one branch pair', async () => {
      const predicate = new FindPRConfigPredicate({
        branchName: sourceBranch,
      });
      expect(
        await predicate.test({
          id: '1',
          number: 1,
          title: 'title',
          state: 'Closed',
          branchPairs: [
            { sourceBranch, targetBranch },
            { sourceBranch, targetBranch },
          ],
        }),
      ).toBe(false);
    });

    it('should return false when source branch is different', async () => {
      const predicate = new FindPRConfigPredicate({
        branchName: sourceBranch,
      });
      expect(
        await predicate.test({
          id: '1',
          number: 1,
          title: 'title',
          state: 'Closed',
          branchPairs: [{ sourceBranch: 'another-branch', targetBranch }],
        }),
      ).toBe(false);
    });

    it('should return false when pr title is set in the config and  does not match', async () => {
      const prTitle = 'my awesome pr';

      const predicate = new FindPRConfigPredicate({
        prTitle,
        branchName: sourceBranch,
      });
      expect(
        await predicate.test({
          id: '1',
          number: 1,
          title: 'title',
          state: 'Closed',
          branchPairs: [{ sourceBranch, targetBranch }],
        }),
      ).toBe(false);
    });

    it('should return true if everything matches', async () => {
      const prTitle = 'my awesome pr';

      const predicate = new FindPRConfigPredicate({
        prTitle,
        branchName: sourceBranch,
      });
      expect(
        await predicate.test({
          id: '1',
          number: 1,
          title: prTitle,
          state: 'Closed',
          branchPairs: [{ sourceBranch, targetBranch }],
        }),
      ).toBe(true);
    });
  });

  function mockMergeRequestBody(
    projectKey: string,
    codeReviewId: string,
    codeReviewNumber: number,
    text: string,
  ) {
    const message: SpaceChannelItemRecord = {
      text: 'this text is no the message body',
      id: text,
      details: {
        projectKey,
        reviewId: codeReviewId,
        reviewNumber: codeReviewNumber,
        description: {
          text,
        },
      },
      created: new Date(),
      time: Date.now(),
      archived: false,
    };

    mockCodeReviewRead.getMessages.mockReturnValueOnce([message]);
  }
});
