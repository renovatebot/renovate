import {REPOSITORY_ARCHIVED} from '../../../constants/error-messages';
import {logger} from '../../../logger';
import {SpaceHttp} from "../../../util/http/space";
import type {
  CodeReviewStateFilter,
  GerritAccountInfo,
  GerritBranchInfo,
  GerritChange,
  GerritChangeMessageInfo,
  GerritFindPRConfig,
  GerritMergeableInfo,
  GerritProjectInfo,
  SpaceBranchInfo,
  SpaceChannelItemRecord,
  SpaceChannelMessagesList,
  SpaceCodeReviewBasicInfo,
  SpaceCodeReviewCreateRequest,
  SpaceJobDTO,
  SpaceJobExecutionDTO,
  SpaceMergeRequestRecord,
  SpacePaginatedResult,
  SpaceRepositoryBasicInfo,
  SpaceRepositoryDetails,
} from './types';
import {mapPrStateToGerritFilter} from './utils';

export class SpaceClient {
  private requestDetails = [
    'SUBMITTABLE', //include the submittable field in ChangeInfo, which can be used to tell if the change is reviewed and ready for submit.
    'CHECK', // include potential problems with the change.
    'MESSAGES',
    'DETAILED_ACCOUNTS',
    'LABELS',
    'CURRENT_ACTIONS', //to check if current_revision can be "rebased"
    'CURRENT_REVISION', //get RevisionInfo::ref to fetch
  ] as const;

  private spaceHttp: SpaceHttp

  constructor(baseUrl: string) {
    this.spaceHttp = new SpaceHttp(baseUrl)
  }

  async findRepositories(): Promise<SpaceRepositoryBasicInfo[]> {
    logger.debug("SPACE: getRepos")

    const iterable = PaginatedIterable.fromGetUsingNext<SpaceRepositoryBasicInfo>(this.spaceHttp, '/api/http/projects/repositories')
    const repos = await iterable.all()
    logger.debug(`SPACE: getRepos, all repos: ${JSON.stringify(repos)}`)

    return repos
  }

  async getRepositoryInfo(projectKey: string, repository: string): Promise<SpaceRepositoryDetails> {
    logger.debug(`SPACE: getRepositoryInfo: repository=${repository}, projectKey=${projectKey}`);
    const repoInfo = await this.spaceHttp.getJson<SpaceRepositoryDetails>(
      `/api/http/projects/key:${projectKey}/repositories/${repository}`,
    );
    return repoInfo.body;
  }

  async findMergeRequestMessages(codeReviewId: string, limit: number, order: 'asc' | 'desc'): Promise<SpaceChannelItemRecord[]> {
    logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId}, limit=${limit}, order=${order}`)

    const apiOrder = order === 'asc' ? 'FromOldestToNewest' : 'FromNewestToOldest'
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

    const iterable = PaginatedIterable.fromGetUsingNext<SpaceCodeReviewBasicInfo>(
      this.spaceHttp, `/api/http/projects/key:${projectKey}/code-reviews?state=${config.prState}${repositoryQueryParam}`
    )

    return await iterable.flatMapNotNull(async basicReview => {
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
    const jobs = await iterable.all()
    logger.debug(`SPACE: findAllJobs: all jobs: ${JSON.stringify(jobs)}`)

    return jobs
  }

  async getRepositoryHeads(projectKey: string, repository: string): Promise<SpaceBranchInfo[]> {
    logger.debug(`SPACE: findRepositoryHeads: projectKey=${projectKey}, repository=${repository}`)

    const iterable = PaginatedIterable.fromGetUsingSkip<SpaceBranchInfo>(
      this.spaceHttp, `/api/http/projects/key:${projectKey}/repositories/${repository}/heads`
    )

    const heads = await iterable.all();
    logger.debug(`SPACE: findRepositoryHeads: result: ${JSON.stringify(heads)}`)

    return heads
  }

  async findJobExecutions(projectKey: string, jobId: string, branch: string, predicate: (dto: SpaceJobExecutionDTO) => boolean = () => true, limit?: number): Promise<SpaceJobExecutionDTO[]> {
    logger.debug(`SPACE: findJobExecutions: projectKey=${projectKey}, jobId=${jobId}, branch=${branch}`)

    const iterable = PaginatedIterable.fromGetUsingNext<SpaceJobExecutionDTO>(
      this.spaceHttp, `/api/http/projects/key:${projectKey}/automation/graph-executions?jobId=${jobId}&branchFilter=${branch}`
    )

    const executions = await iterable.flatMapNotNull(dto => {
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

  async getProjectInfo(repository: string): Promise<GerritProjectInfo> {
    const projectInfo = await this.spaceHttp.getJson<GerritProjectInfo>(
      `a/projects/${encodeURIComponent(repository)}`,
    );
    if (projectInfo.body.state !== 'ACTIVE') {
      throw new Error(REPOSITORY_ARCHIVED);
    }
    return projectInfo.body;
  }

  async getBranchInfo(repository: string): Promise<GerritBranchInfo> {
    const branchInfo = await this.spaceHttp.getJson<GerritBranchInfo>(
      `a/projects/${encodeURIComponent(repository)}/branches/HEAD`,
    );
    return branchInfo.body;
  }

  async findChanges(
    repository: string,
    findPRConfig: GerritFindPRConfig,
    refreshCache?: boolean,
  ): Promise<GerritChange[]> {
    logger.debug(`SPACE: findChanges: repository=${repository}`);

    const filters = SpaceClient.buildSearchFilters(repository, findPRConfig);
    const changes = await this.spaceHttp.getJson<GerritChange[]>(
      `a/changes/?q=` +
      filters.join('+') +
      this.requestDetails.map((det) => `&o=${det}`).join(''),
      {memCache: !refreshCache},
    );
    logger.trace(
      `findChanges(${filters.join(', ')}) => ${changes.body.length}`,
    );
    return changes.body;
  }

  async getChange(changeNumber: number): Promise<GerritChange> {
    const changes = await this.spaceHttp.getJson<GerritChange>(
      `a/changes/${changeNumber}?` +
      this.requestDetails.map((det) => `o=${det}`).join('&'),
    );
    return changes.body;
  }

  async getMergeableInfo(change: GerritChange): Promise<GerritMergeableInfo> {
    const mergeable = await this.spaceHttp.getJson<GerritMergeableInfo>(
      `a/changes/${change._number}/revisions/current/mergeable`,
    );
    return mergeable.body;
  }

  async abandonChange(changeNumber: number): Promise<void> {
    await this.spaceHttp.postJson(`a/changes/${changeNumber}/abandon`);
  }

  async submitChange(changeNumber: number): Promise<GerritChange> {
    const change = await this.spaceHttp.postJson<GerritChange>(
      `a/changes/${changeNumber}/submit`,
    );
    return change.body;
  }

  async setCommitMessage(changeNumber: number, message: string): Promise<void> {
    await this.spaceHttp.putJson(`a/changes/${changeNumber}/message`, {
      body: {message},
    });
  }

  async updateCommitMessage(
    number: number,
    gerritChangeID: string,
    prTitle: string,
  ): Promise<void> {
    await this.setCommitMessage(
      number,
      `${prTitle}\n\nChange-Id: ${gerritChangeID}\n`,
    );
  }

  async getMessages(changeNumber: number): Promise<GerritChangeMessageInfo[]> {
    const messages = await this.spaceHttp.getJson<GerritChangeMessageInfo[]>(
      `a/changes/${changeNumber}/messages`,
      {memCache: false},
    );
    return messages.body;
  }

  async addMessage(
    changeNumber: number,
    fullMessage: string,
    tag?: string,
  ): Promise<void> {
    const message = this.normalizeMessage(fullMessage);
    await this.spaceHttp.postJson(
      `a/changes/${changeNumber}/revisions/current/review`,
      {body: {message, tag}},
    );
  }

  async checkForExistingMessage(
    changeNumber: number,
    newMessage: string,
    msgType?: string,
  ): Promise<boolean> {
    const messages = await this.getMessages(changeNumber);
    return messages.some(
      (existingMsg) =>
        (msgType === undefined || msgType === existingMsg.tag) &&
        existingMsg.message.includes(newMessage),
    );
  }

  async addMessageIfNotAlreadyExists(
    changeNumber: number,
    message: string,
    tag?: string,
  ): Promise<void> {
    const newMsg = this.normalizeMessage(message);
    if (!(await this.checkForExistingMessage(changeNumber, newMsg, tag))) {
      await this.addMessage(changeNumber, newMsg, tag);
    }
  }

  async setLabel(
    changeNumber: number,
    label: string,
    value: number,
  ): Promise<void> {
    await this.spaceHttp.postJson(
      `a/changes/${changeNumber}/revisions/current/review`,
      {body: {labels: {[label]: value}}},
    );
  }

  async addReviewer(changeNumber: number, reviewer: string): Promise<void> {
    await this.spaceHttp.postJson(`a/changes/${changeNumber}/reviewers`, {
      body: {reviewer},
    });
  }

  async addAssignee(changeNumber: number, assignee: string): Promise<void> {
    await this.spaceHttp.putJson<GerritAccountInfo>(
      `a/changes/${changeNumber}/assignee`,
      {
        body: {assignee},
      },
    );
  }

  async getFile(
    repo: string,
    branch: string,
    fileName: string,
  ): Promise<string> {
    const base64Content = await this.spaceHttp.get(
      `a/projects/${encodeURIComponent(
        repo,
      )}/branches/${branch}/files/${encodeURIComponent(fileName)}/content`,
    );
    return Buffer.from(base64Content.body, 'base64').toString();
  }

  async approveChange(changeId: number): Promise<void> {
    const isApproved = await this.checkIfApproved(changeId);
    if (!isApproved) {
      await this.setLabel(changeId, 'Code-Review', +2);
    }
  }

  async checkIfApproved(changeId: number): Promise<boolean> {
    const change = await this.getChange(changeId);
    const reviewLabels = change?.labels?.['Code-Review'];
    return reviewLabels === undefined || reviewLabels.approved !== undefined;
  }

  wasApprovedBy(change: GerritChange, username: string): boolean | undefined {
    return (
      change.labels?.['Code-Review'].approved &&
      change.labels['Code-Review'].approved.username === username
    );
  }

  normalizeMessage(message: string): string {
    //the last \n was removed from gerrit after the comment was added...
    return message.substring(0, 0x4000).trim();
  }

  private static buildSearchFilters(
    repository: string,
    searchConfig: GerritFindPRConfig,
  ): string[] {
    const filterState = mapPrStateToGerritFilter(searchConfig.state);
    const filters = ['owner:self', 'project:' + repository, filterState];
    if (searchConfig.branchName !== '') {
      filters.push(`hashtag:sourceBranch-${searchConfig.branchName}`);
    }
    if (searchConfig.targetBranch) {
      filters.push(`branch:${searchConfig.targetBranch}`);
    }
    if (searchConfig.label) {
      filters.push(`label:Code-Review=${searchConfig.label}`);
    }
    if (searchConfig.prTitle) {
      filters.push(
        `message:${encodeURIComponent('"' + searchConfig.prTitle + '"')}`,
      );
    }
    return filters;
  }
}

interface FindMergeRequestConfig {
  repository?: string;
  prState: CodeReviewStateFilter;
  predicate: (pr: SpaceMergeRequestRecord) => Promise<boolean>;
  limit?: number;
}

class PaginatedIterable<T> implements AsyncIterable<T[]> {

  constructor(private nextPage: (next?: string) => Promise<SpacePaginatedResult<T>>) {

  }

  [Symbol.asyncIterator](): AsyncIterator<T[], any, undefined> {
    return new PaginatedIterator(this.nextPage)
  }

  static fromGetUsingNext<T>(http: SpaceHttp, basePath: string): PaginatedIterable<T> {
    return this.fromUsing(http, basePath, 'next')
  }

  static fromGetUsingSkip<T>(http: SpaceHttp, basePath: string): PaginatedIterable<T> {
    return this.fromUsing(http, basePath, 'skip')
  }

  private static fromUsing<T>(http: SpaceHttp, basePath: string, parameter: string): PaginatedIterable<T> {
    const hasQuery = basePath.includes('?')

    return new PaginatedIterable<T>(async (next?: string) => {
      logger.debug(`SPACE: iterating over ${basePath} with next=${next}`)

      let path = basePath
      if (next) {
        if (hasQuery) {
          path += `&${parameter}=${next}`
        } else {
          path += `?${parameter}=${next}`
        }
      }

      const result = await http.getJson<SpacePaginatedResult<T>>(path)
      logger.debug(`SPACE: from ${basePath} and next ${next} got ${JSON.stringify(result.body.data)}`)

      return result.body
    })
  }

  async findFirst(predicate: (value: T) => boolean): Promise<T | undefined> {
    return await this.findFirstAsync(it => Promise.resolve(predicate(it)))
  }

  async findFirstAsync(predicate: (value: T) => Promise<boolean>): Promise<T | undefined> {
    for await (const page of this) {
      for (const element of page) {
        if (await predicate(element)) {
          return element
        }
      }
    }
  }

  async flatMapNotNull<R>(mapper: (value: T) => Promise<R | undefined>, limit?: number): Promise<R[]> {
    const result: R[] = []

    for await (const page of this) {
      for (const element of page) {
        const mapped = await mapper(element)
        if (mapped) {
          result.push(mapped)
        }

        if (limit && result.length >= limit) {
          return result
        }
      }
    }

    return result
  }


  all(): Promise<T[]> {
    return this.flatMapNotNull(it => Promise.resolve(it))
  }
}

class PaginatedIterator<T> implements AsyncIterator<T[]> {

  private currentPage?: string = undefined

  constructor(private nextPage: (next?: string) => Promise<SpacePaginatedResult<T>>) {

  }

  async next(...args: [] | [undefined]): Promise<IteratorResult<T[]>> {
    const result = await this.nextPage(this.currentPage)
    const done = this.currentPage === result.next
    this.currentPage = result.next
    return Promise.resolve({value: result.data, done})
  }
}
