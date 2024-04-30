import {expect} from '@jest/globals';
import type {SpaceClient} from "./client";
import {SpaceDao} from "./dao";
import type {SpaceMergeRequestRecord, SpaceRepositoryBasicInfo, SpaceRepositoryDetails} from "./types";
import {hashBody} from "../pr-body";

jest.mock('./client')

describe('modules/platform/space/dao', () => {
  const mockRepository = { getAll: jest.fn(), getByName: jest.fn() }

  const mockJobs = { getAll: jest.fn() }

  const mockCodeReviewWrite = { create: jest.fn() }
  const mockCodeReviewRead = { create: jest.fn() }
  const mockSpaceClient: jest.Mocked<SpaceClient> = {
    repository: mockRepository as any,
    jobs: mockJobs as any,
    codeReview: {
      write: mockCodeReviewWrite as any,
      read: mockCodeReviewRead as any,
    },
  }

  const dao = new SpaceDao(mockSpaceClient)

  describe('findRepositories()', () => {
    it('should find all repositories', async () => {
      const repo1: SpaceRepositoryBasicInfo = {
        projectKey: 'project1',
        repository: 'repo1',
      }

      const repo2: SpaceRepositoryBasicInfo = {
        projectKey: 'project2',
        repository: 'repo2',
      }

      mockRepository.getAll.mockReturnValueOnce([repo1, repo2]);
      expect(await dao.findRepositories()).toEqual([`${repo1.projectKey}/${repo1.repository}`, `${repo2.projectKey}/${repo2.repository}`]);
    });
  });

  describe('getRepositoryInfo()', () => {
    it('should find all repositories', async () => {
      const projectKey = 'my-project'
      const repository = 'my-repo'

      const result: SpaceRepositoryDetails = {
        name: repository,
        description: 'description',
      }
      mockRepository.getByName.mockReturnValueOnce(result)
      expect(await dao.getRepositoryInfo(projectKey, repository)).toEqual(result);
      expect(mockRepository.getByName).toHaveBeenCalledWith(projectKey, repository);
    });
  });

  describe('createMergeRequest()', () => {
    it('should create a merge request', async () => {
      const projectKey = 'my-project'
      const repository = 'my-repo'
      const sourceBranch = 'my-feature-branch'
      const targetBranch = 'my-main-branch'
      const title = 'my awesome pr'
      const description = 'please merge it, its awesome'

      const response: SpaceMergeRequestRecord = {
        id: '123',
        number: 1,
        title,
        state: 'Opened',
        branchPairs: [{ sourceBranch, targetBranch }],
        createdAt: 123,
        description,
      }
      mockCodeReviewWrite.create.mockReturnValueOnce(response)

      expect(await dao.createMergeRequest(projectKey, repository, {
        sourceBranch,
        targetBranch,
        prTitle: title,
        prBody: description,
      })).toEqual({
        bodyStruct: {
          hash: hashBody(description),
        },
        number: 1,
        sourceBranch,
        targetBranch,
        state: "open",
        title
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

});
