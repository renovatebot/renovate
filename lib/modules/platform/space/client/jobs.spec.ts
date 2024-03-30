import { expect } from '@jest/globals';
import * as httpMock from '../../../../../test/http-mock';
import { SpaceHttp } from '../../../../util/http/space';
import type { SpaceJobDTO, SpaceJobExecutionDTO } from '../types';
import { SpaceJobsClient } from './jobs';

const spaceEndpointUrl = 'https://myorg.jetbrains.space';
const jsonResultHeader = { 'content-type': 'application/json;charset=utf-8' };

describe('modules/platform/space/client/jobs', () => {
  const client = new SpaceJobsClient(new SpaceHttp(spaceEndpointUrl));

  describe('getAllJobs()', () => {
    it('should return jobs', async () => {
      const projectKey = 'my-project';
      const repository = 'my-repo';
      const branch = 'my-branch';

      const job1: SpaceJobDTO = {
        id: 'job1_id',
        name: 'job1_name',
        repoName: 'job1_repo',
        archive: false,
      };
      const job2: SpaceJobDTO = {
        id: 'job2_id',
        name: 'job2_name',
        repoName: 'job2_repo',
        archive: false,
      };

      const next1 = 'next1';
      const next2 = 'next2';

      mockJobsPage(projectKey, repository, branch, [job1], next1);
      mockJobsPage(projectKey, repository, branch, [job2], next2, next1);
      mockJobsPage(projectKey, repository, branch, [], next2, next2);

      expect(await client.getAllJobs(projectKey, repository, branch)).toEqual([
        job1,
        job2,
      ]);
    });
  });

  describe('findJobExecutions()', () => {
    it('should find job executions', async () => {
      const projectKey = 'test123';
      const jobId = 'job312';
      const branch = 'my-cool-branch';
      const filteredOutCommit = 'not-my-commit';

      const execution1: SpaceJobExecutionDTO = {
        executionId: 'exec_1',
        executionNumber: 10,
        jobId,
        branch,
        status: 'PENDING',
        commitId: '321commit',
      };

      const execution2: SpaceJobExecutionDTO = {
        executionId: 'exec_2',
        executionNumber: 11,
        jobId,
        branch,
        status: 'RESTARTING',
        commitId: '123commit',
      };

      const filteredOutExecution: SpaceJobExecutionDTO = {
        executionId: 'exec_3',
        executionNumber: 12,
        jobId,
        branch,
        status: 'RESTARTING',
        commitId: filteredOutCommit,
      };

      const next1 = 'next1';
      const next2 = 'next2';

      mockJobExecutionsPage(
        projectKey,
        jobId,
        branch,
        [execution1, filteredOutExecution],
        next1,
      );
      mockJobExecutionsPage(
        projectKey,
        jobId,
        branch,
        [execution2],
        next2,
        next1,
      );
      mockJobExecutionsPage(projectKey, jobId, branch, [], next2, next2);

      const actual = await client.findJobExecutions(
        projectKey,
        jobId,
        branch,
        (it) => it.commitId !== filteredOutCommit,
      );
      expect(actual).toEqual([execution1, execution2]);
    });
  });
});

function mockJobsPage(
  projectKey: string,
  repository: string,
  branch: string,
  jobs: SpaceJobDTO[],
  next: string,
  nextQuery?: string,
) {
  let path = `/api/http/projects/key:${projectKey}/automation/jobs?repoFilter=${repository}&branchFilter=${branch}`;
  if (nextQuery) {
    path += `&next=${nextQuery}`;
  }

  httpMock.scope(spaceEndpointUrl).get(path).reply(
    200,
    {
      next,
      data: jobs,
    },
    jsonResultHeader,
  );
}

function mockJobExecutionsPage(
  projectKey: string,
  jobId: string,
  branch: string,
  executions: SpaceJobExecutionDTO[],
  next: string,
  nextQuery?: string,
) {
  let path = `/api/http/projects/key:${projectKey}/automation/graph-executions?jobId=${jobId}&branchFilter=${branch}`;
  if (nextQuery) {
    path += `&next=${nextQuery}`;
  }

  httpMock.scope(spaceEndpointUrl).get(path).reply(
    200,
    {
      next,
      data: executions,
    },
    jsonResultHeader,
  );
}
