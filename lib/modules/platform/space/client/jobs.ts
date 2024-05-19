import { logger } from '../../../../logger';
import type { SpaceHttp } from '../../../../util/http/space';
import { PaginatedIterable } from '../paginated-iterator';
import type { SpaceJobDTO, SpaceJobExecutionDTO } from '../types';
import { flatten, mapNotNullFlatten } from '../utils';

export class SpaceJobsClient {
  constructor(private http: SpaceHttp) {}

  async getAll(
    projectKey: string,
    repository: string,
    branch: string,
  ): Promise<SpaceJobDTO[]> {
    logger.trace(
      `SPACE: findAllJobs: projectKey=${projectKey}, repository=${repository}, branch=${branch}`,
    );

    const iterable = PaginatedIterable.fromGetUsingNext<SpaceJobDTO>(
      this.http,
      `/api/http/projects/key:${projectKey}/automation/jobs?repoFilter=${repository}&branchFilter=${branch}`,
    );
    return await flatten(iterable);
  }

  async findJobExecutions(
    projectKey: string,
    jobId: string,
    branch: string,
    predicate: (dto: SpaceJobExecutionDTO) => boolean = () => true,
    limit?: number,
  ): Promise<SpaceJobExecutionDTO[]> {
    logger.trace(
      `SPACE: findJobExecutions: projectKey=${projectKey}, jobId=${jobId}, branch=${branch}`,
    );

    const iterable = PaginatedIterable.fromGetUsingNext<SpaceJobExecutionDTO>(
      this.http,
      `/api/http/projects/key:${projectKey}/automation/graph-executions?jobId=${jobId}&branchFilter=${branch}`,
    );

    const executions = await mapNotNullFlatten(
      iterable,
      (dto) => {
        if (predicate(dto)) {
          return Promise.resolve(dto);
        } else {
          return Promise.resolve(undefined);
        }
      },
      limit,
    );

    return executions;
  }
}
