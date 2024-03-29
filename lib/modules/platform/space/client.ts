import {logger} from '../../../logger';
import {SpaceHttp} from "../../../util/http/space";
import type {
  CodeReviewStateFilter,
  SpaceBranchInfo,
  SpaceChannelItemRecord,
  SpaceChannelMessagesList,
  SpaceCodeReviewBasicInfo,
  SpaceCodeReviewCreateRequest,
  SpaceCodeReviewParticipantRole,
  SpaceFileContent,
  SpaceJobDTO,
  SpaceJobExecutionDTO,
  SpaceMergeRequestRecord,
  SpaceRepositoryBasicInfo,
  SpaceRepositoryDetails,
} from './types';
import {PaginatedIterable} from "./paginated-iterator";
import {flatten, mapNotNullFlatten} from "./utils";

export class SpaceClient {

  private readonly spaceHttp: SpaceHttp

  constructor(baseUrl: string) {
    this.spaceHttp = new SpaceHttp(baseUrl)
  }

  async getAllRepositoriesForAllProjects(): Promise<SpaceRepositoryBasicInfo[]> {
    logger.debug("SPACE: getAllRepositoriesForAllProjects")

    const iterable = PaginatedIterable.fromGetUsingNext<SpaceRepositoryBasicInfo>(this.spaceHttp, '/api/http/projects/repositories')
    const repos = await flatten(iterable)
    logger.debug(`SPACE: getAllRepositoriesForAllProjects, all repos: ${JSON.stringify(repos)}`)

    return repos
  }

  async getRepository(projectKey: string, repository: string): Promise<SpaceRepositoryDetails> {
    logger.debug(`SPACE: getRepositoryInfo: repository=${repository}, projectKey=${projectKey}`);
    const repoInfo = await this.spaceHttp.getJson<SpaceRepositoryDetails>(
      `/api/http/projects/key:${projectKey}/repositories/${repository}`,
    );
    return repoInfo.body;
  }

  // finding messages by code review number is not supported yet
  async findCodeReviewMessages(codeReviewId: string, limit: number, order: 'asc' | 'desc'): Promise<SpaceChannelItemRecord[]> {
    logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId}, limit=${limit}, order=${order}`)

    const apiOrder = order === 'asc' ? 'FromOldestToNewest' : 'FromNewestToOldest'

    // TODO: add pagination
    const channelMessages = await this.spaceHttp.getJson<SpaceChannelMessagesList>(`/api/http/chats/messages?channel=codeReview:id:${codeReviewId}&sorting=${apiOrder}&batchSize=${limit}`)

    const result: SpaceChannelItemRecord[] = []
    for (const {id} of channelMessages.body.messages) {
      logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId} fetching message id=${id}`)

      const message = await this.spaceHttp.getJson<SpaceChannelItemRecord>(`/api/http/chats/messages/id:${id}?channel=codeReview:id:${codeReviewId}`)
      logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId} message = ${message.body.time}`)

      result.push(message.body)
    }

    logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId} found ${result.length} messages`)
    return result
  }

  async addCodeReviewComment(codeReviewId: string, comment: string, externalId: string | null): Promise<void> {
    logger.debug(`SPACE addCodeReviewComment(${codeReviewId}, ${comment})`)

    await this.spaceHttp.postJson(
      `/api/http/chats/messages/send-message`,
      {
        body: {
          channel: `codeReview:id:${codeReviewId}`,
          content: {
            className: "ChatMessage.Text",
            text: comment
          },
          externalId
        }
      }
    )
  }

  async deleteCodeReviewComment(codeReviewId: string, messageId: string): Promise<void> {
    logger.debug(`SPACE deleteCodeReviewCommentByExternalId(${codeReviewId}, ${messageId})`)

    await this.spaceHttp.postJson(
      `/api/http/chats/messages/delete-message`,
      {
        body: {
          channel: `codeReview:id:${codeReviewId}`,
          id: `id:${messageId}`
        }
      }
    )
  }

  async findMergeRequests(
    projectKey: string,
    partialConfig: Partial<FindMergeRequestConfig> = {}
  ): Promise<SpaceMergeRequestRecord[]> {
    const config: FindMergeRequestConfig = {
      prState: 'null',
      predicate: () => Promise.resolve(true),
      ...partialConfig
    }

    let repositoryQueryParam = ''
    if (config.repository) {
      repositoryQueryParam = `&repository=${config.repository}`
    }

    const iterable = PaginatedIterable.fromGetUsingSkip<SpaceCodeReviewBasicInfo>(
      this.spaceHttp, `/api/http/projects/key:${projectKey}/code-reviews?$top=1&state=${config.prState}${repositoryQueryParam}`
    )

    return await mapNotNullFlatten(iterable, async basicReview => {
      // not sure what is this, but doesn't look like a renovate one
      if (basicReview.review.className === 'CommitSetReviewRecord') {
        return undefined
      }

      const review = await this.getCodeReviewByCodeReviewId(projectKey, basicReview.review.id)
      if (review.state === 'Deleted') {
        // should not normally be returned, but who knows
        logger.info(`SPACE: Ignoring PR ${review.title} because it is deleted`)
        return undefined
      }

      const accept = await config.predicate(review)
      return accept ? review : undefined
    }, config.limit)
  }

  async getCodeReviewByCodeReviewId(projectKey: string, codeReviewId: string): Promise<SpaceMergeRequestRecord> {
    const result = await this.spaceHttp.getJson<SpaceMergeRequestRecord>(`/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}`)
    return result.body
  }

  async getCodeReviewByCodeReviewNumber(projectKey: string, codeReviewNumber: number): Promise<SpaceMergeRequestRecord> {
    const result = await this.spaceHttp.getJson<SpaceMergeRequestRecord>(`/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}`)
    return result.body
  }

  async updateCodeReviewTitle(projectKey: string, codeReviewId: string, title: string): Promise<void> {
    await this.spaceHttp.patchJson(`/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}/title`, {body: {title}})
  }

  async updateCodeReviewDescription(projectKey: string, codeReviewId: string, description: string): Promise<void> {
    logger.debug(`SPACE: updateCodeReviewDescription: projectKey=${projectKey}, codeReviewId=${codeReviewId}, description=${description}`)
    await this.spaceHttp.patchJson(`/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}/description`, {body: {description}})
  }

  async updateCodeReviewState(projectKey: string, codeReviewId: string, state: CodeReviewStateFilter): Promise<void> {
    logger.debug(`SPACE: updateCodeReviewState: projectKey=${projectKey}, codeReviewId=${codeReviewId}, state=${state}`)
    await this.spaceHttp.patchJson(`/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}/state`, {body: {state}})
  }

  async createMergeRequest(projectKey: string, request: SpaceCodeReviewCreateRequest): Promise<SpaceMergeRequestRecord> {
    logger.debug(`SPACE: createMergeRequest: projectKey=${projectKey}, request=${JSON.stringify(request)}`)

    const response = await this.spaceHttp.postJson<SpaceMergeRequestRecord>(`/api/http/projects/key:${projectKey}/code-reviews/merge-requests`, {body: request})
    logger.debug(`SPACE: createMergeRequest: response: ${JSON.stringify(response.body)}`)

    return response.body
  }

  async findAllJobs(projectKey: string, repository: string, branch: string): Promise<SpaceJobDTO[]> {
    logger.debug(`SPACE: findAllJobs: projectKey=${projectKey}, repository=${repository}, branch=${branch}`)

    const iterable = PaginatedIterable.fromGetUsingNext<SpaceJobDTO>(
      this.spaceHttp, `/api/http/projects/key:${projectKey}/automation/jobs?repoFilter=${repository}&branchFilter=${branch}`
    )
    const jobs = await flatten(iterable)
    logger.debug(`SPACE: findAllJobs: all jobs: ${JSON.stringify(jobs)}`)

    return jobs
  }

  async getRepositoryHeads(projectKey: string, repository: string): Promise<SpaceBranchInfo[]> {
    logger.debug(`SPACE: findRepositoryHeads: projectKey=${projectKey}, repository=${repository}`)

    const iterable = PaginatedIterable.fromGetUsingSkip<SpaceBranchInfo>(
      this.spaceHttp, `/api/http/projects/key:${projectKey}/repositories/${repository}/heads`
    )

    const heads = await flatten(iterable)
    logger.debug(`SPACE: findRepositoryHeads: result: ${JSON.stringify(heads)}`)

    return heads
  }

  async findJobExecutions(projectKey: string, jobId: string, branch: string, predicate: (dto: SpaceJobExecutionDTO) => boolean = () => true, limit?: number): Promise<SpaceJobExecutionDTO[]> {
    logger.debug(`SPACE: findJobExecutions: projectKey=${projectKey}, jobId=${jobId}, branch=${branch}`)

    const iterable = PaginatedIterable.fromGetUsingNext<SpaceJobExecutionDTO>(
      this.spaceHttp, `/api/http/projects/key:${projectKey}/automation/graph-executions?jobId=${jobId}&branchFilter=${branch}`
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

  async mergeMergeRequest(projectKey: string, codeReviewNumber: number, mergeMode: 'FF' | 'FF_ONLY' | 'NO_FF', deleteSourceBranch: boolean): Promise<void> {
    logger.debug(`SPACE mergeMergeRequest(${projectKey}, ${codeReviewNumber}, ${mergeMode}, ${deleteSourceBranch})`)

    await this.spaceHttp.putJson(
      `/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}/merge`,
      {body: {mergeMode, deleteSourceBranch}}
    )
  }

  async rebaseMergeRequest(projectKey: string, codeReviewNumber: number, rebaseMode: 'FF' | 'NO_FF', squashedCommitMessage: string | null, deleteSourceBranch: boolean): Promise<void> {
    logger.debug(`SPACE rebaseMergeRequest(${projectKey}, ${codeReviewNumber}, ${rebaseMode}, ${squashedCommitMessage}, ${deleteSourceBranch})`)

    const squash = !!squashedCommitMessage
    await this.spaceHttp.putJson(
      `/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}/rebase`,
      {body: {rebaseMode, deleteSourceBranch, squash, squashedCommitMessage}}
    )
  }

  async getFileTextContent(projectKey: string, repository: string, path: string, commit: string): Promise<string> {
    logger.debug(`SPACE getFileTextContent(${projectKey}, ${repository}, ${commit}, ${path})`)

    const fileContent = await this.spaceHttp.getJson<SpaceFileContent>(
      `/api/http/projects/key:${projectKey}/repositories/${repository}/text-content?commit=${commit}&path=${path}`,
    )
    const body = fileContent.body
    logger.debug(`SPACE getFileTextContent(${projectKey}, ${repository}, ${commit}, ${path}): got ${body.lines.length}`)

    return body.lines.map(it => it.text).join("\n")
  }

  async addReviewer(projectKey: string, codeReviewNumber: number, username: string, role: SpaceCodeReviewParticipantRole): Promise<void> {
    logger.debug(`SPACE addReviewer(${projectKey}, ${codeReviewNumber}, ${username}, ${role})`)

    await this.spaceHttp.postJson(
      `/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}/participants/username:${username}`,
      {body: {role}}
    )
  }
}

interface FindMergeRequestConfig {
  repository?: string;
  prState: CodeReviewStateFilter;
  predicate: (pr: SpaceMergeRequestRecord) => Promise<boolean>;
  limit?: number;
}


