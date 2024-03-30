import type {SpaceHttp} from "../../../../util/http/space";
import type {SpaceJobDTO, SpaceJobExecutionDTO} from "../types";
import {logger} from "../../../../logger";
import {PaginatedIterable} from "../paginated-iterator";
import {flatten, mapNotNullFlatten} from "../utils";

export class SpaceJobsClient {
  constructor(private http: SpaceHttp) {
  }

  async getAllJobs(projectKey: string, repository: string, branch: string): Promise<SpaceJobDTO[]> {
    logger.debug(`SPACE: findAllJobs: projectKey=${projectKey}, repository=${repository}, branch=${branch}`)

    const iterable = PaginatedIterable.fromGetUsingNext<SpaceJobDTO>(
      this.http, `/api/http/projects/key:${projectKey}/automation/jobs?repoFilter=${repository}&branchFilter=${branch}`
    )
    const jobs = await flatten(iterable)
    logger.debug(`SPACE: findAllJobs: all jobs: ${JSON.stringify(jobs)}`)

    return jobs
  }

  async findJobExecutions(projectKey: string, jobId: string, branch: string, predicate: (dto: SpaceJobExecutionDTO) => boolean = () => true, limit?: number): Promise<SpaceJobExecutionDTO[]> {
    logger.debug(`SPACE: findJobExecutions: projectKey=${projectKey}, jobId=${jobId}, branch=${branch}`)

    const iterable = PaginatedIterable.fromGetUsingNext<SpaceJobExecutionDTO>(
      this.http, `/api/http/projects/key:${projectKey}/automation/graph-executions?jobId=${jobId}&branchFilter=${branch}`
    )

    const executions = await mapNotNullFlatten(iterable, dto => {
      if (predicate(dto)) {
        return Promise.resolve(dto)
      } else {
        return Promise.resolve(undefined)
      }
    }, limit)

    logger.debug(`SPACE: findJobExecutions: found: ${executions.length}`)

    return executions
  }
}
