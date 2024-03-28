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
  GerritProjectInfo, SpaceChannelItemRecord, SpaceChannelMessagesList,
  SpaceCodeReviewBasicInfo, SpaceCodeReviewCreateRequest,
  SpaceMergeRequestRecord,
  SpacePaginatedResult,
  SpaceProject,
  SpaceRepositoryBasicInfo,
  SpaceRepositoryDetails,
} from './types';
import {mapPrStateToGerritFilter} from './utils';
import type {CreatePRConfig, FindPRConfig} from "../types";

class SpaceClient {
  private requestDetails = [
    'SUBMITTABLE', //include the submittable field in ChangeInfo, which can be used to tell if the change is reviewed and ready for submit.
    'CHECK', // include potential problems with the change.
    'MESSAGES',
    'DETAILED_ACCOUNTS',
    'LABELS',
    'CURRENT_ACTIONS', //to check if current_revision can be "rebased"
    'CURRENT_REVISION', //get RevisionInfo::ref to fetch
  ] as const;

  private spaceHttp = new SpaceHttp();

  async findProjectByKey(key: string): Promise<SpaceProject> {
    logger.debug(`SPACE: findProjectByKey(${key})`)

    const iterable = PaginatedIterable.fromUrl<SpaceProject>(this.spaceHttp, '/api/http/projects')
    const result = await iterable.find(it => it.key.key.toLowerCase() === key.toLowerCase())
    return result!
  }

  async findRepositories(): Promise<string[]> {
    logger.debug("SPACE: getRepos")

    const iterable = PaginatedIterable.fromUrl<SpaceRepositoryBasicInfo>(this.spaceHttp, '/api/http/projects/repositories')
    const repos = await iterable.all()
    logger.debug(`SPACE: getRepos, all repos: ${JSON.stringify(repos)}`)

    return repos.map(it => `${it.projectKey}/${it.repository}`)
  }

  async getRepositoryInfo(projectKey: string, repository: string): Promise<SpaceRepositoryDetails> {
    logger.debug(`SPACE: getRepositoryInfo: repository=${repository}, projectKey=${projectKey}`);
    const repoInfo = await this.spaceHttp.getJson<SpaceRepositoryDetails>(
      `/api/http/projects/key:${projectKey}/repositories/${repository}`,
    );
    return repoInfo.body;
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

  async findMergeRequestBody(codeReviewId: string) {
    logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId}`)
    const channelMessages = await this.spaceHttp.getJson<SpaceChannelMessagesList>(`/api/http/chats/messages?channel=codeReview:id:${codeReviewId}&sorting=FromOldestToNewest&batchSize=1`)
    const messageId = channelMessages.body.messages[0].id

    logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId} first message id = ${messageId}`)

    const message = await this.spaceHttp.getJson<SpaceChannelItemRecord>(`/api/http/chats/messages/id:${messageId}?channel=codeReview:id:${codeReviewId}`)
    logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId} message = ${JSON.stringify(message.body)}`)
    return message.body.details?.description?.text
  }

  async findMergeRequests(projectKey: string, repository: string, state: CodeReviewStateFilter): Promise<SpaceMergeRequestRecord[]> {
    const iterable = PaginatedIterable.fromUrl<SpaceCodeReviewBasicInfo>(
      this.spaceHttp, `/api/http/projects/key:${projectKey}/code-reviews?state=${state}&repository=${repository}`
    )
    return iterable.flatMap(async basicReview => this.getCodeReview(projectKey, basicReview.review.id))
  }

  async findMergeRequest(projectKey: string, repository: string, config: FindPRConfig): Promise<SpaceMergeRequestRecord | undefined> {
    let prState: CodeReviewStateFilter = 'null'
    const allButOpen = config.state == '!open'
    switch (config.state) {
      case 'open':
        prState = 'Opened';
        break
      case 'closed':
        prState = 'Closed';
        break
      case '!open':
      case 'all':
        prState = 'null';
        break
    }

    const iterable = PaginatedIterable.fromUrl<SpaceCodeReviewBasicInfo>(
      this.spaceHttp,
      `/api/http/projects/key:${projectKey}/code-reviews?state=${prState}&repository=${repository}`
    )
    const review = await iterable.findAsync(async basicReview => {
      // not sure what is this, but doesn't look like a renovate one
      if (basicReview.review.className == 'CommitSetReviewRecord') {
        return false
      }

      const review = await this.getCodeReview(projectKey, basicReview.review.id)
      if (review.state == 'Deleted') {
        logger.info(`SPACE: Ignoring PR ${review.title} because it is deleted`)
        return false
      }

      if (allButOpen && review.state === 'Opened') {
        logger.info(`SPACE: stateFilter=${config.state}. Ignoring PR ${review.title} because it is open`)
        return false
      }

      // TODO: figure out what is the case here
      if (review.branchPairs.length != 1) {
        logger.debug(`SPACE: Not sure what to do with not a single branch pair in PR ${review.title}`)
        return false
      }

      if (review.branchPairs[0].sourceBranch != config.branchName) {
        logger.debug(`SPACE: branchFilter=${config.branchName}. Ignoring PR ${review.title} because it doesn't match the branch`)
        return false
      }

      if (config.prTitle && review.title != config.prTitle) {
        return false
      }

      logger.debug(`SPACE: branchFilter=${config.branchName}. found PR ${review.title} with state ${review.state}`)
      return true
    })

    if (review) {
      return await this.getCodeReview(projectKey, review!.review.id)
    }
  }

  async getCodeReview(projectKey: string, codeReviewId: string): Promise<SpaceMergeRequestRecord> {
    const result = await this.spaceHttp.getJson<SpaceMergeRequestRecord>(`/api/http/projects/key:${projectKey}/code-reviews/${codeReviewId}`)
    return result.body
  }

  async createMergeRequest(projectKey: string, repository: string, config: CreatePRConfig): Promise<SpaceMergeRequestRecord> {
    logger.debug(`SPACE: createMergeRequest: projectKey=${projectKey}, repository=${repository}, config: ${JSON.stringify(config)}`)

    const request : SpaceCodeReviewCreateRequest = {
      repository: repository,
      sourceBranch: config.sourceBranch,
      targetBranch: config.targetBranch,
      title: config.prTitle,
      description: config.prBody,
    }

    const response = await this.spaceHttp.postJson<SpaceMergeRequestRecord>(`/api/http/projects/key:${projectKey}/code-reviews/merge-requests`, {body: request})
    logger.debug(`SPACE: createMergeRequest: response: ${JSON.stringify(response.body)}`)

    return response.body
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
    const change = await client.getChange(changeId);
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

class PaginatedIterable<T> implements AsyncIterable<T[]> {

  constructor(private nextPage: (next?: string) => Promise<SpacePaginatedResult<T>>) {

  }

  [Symbol.asyncIterator](): AsyncIterator<T[], any, undefined> {
    return new PaginatedIterator(this.nextPage)
  }

  static fromUrl<T>(http: SpaceHttp, basePath: string): PaginatedIterable<T> {
    const hasQuery = basePath.includes('?')

    return new PaginatedIterable<T>(async (next?: string) => {
      logger.debug(`SPACE: iterating over ${basePath} with next=${next}`)

      let path = basePath
      if (next) {
        if (hasQuery) {
          path += `&next=${next}`
        } else {
          path += `?next=${next}`
        }
      }

      const result = await http.getJson<SpacePaginatedResult<T>>(path)
      logger.debug(`SPACE: from ${basePath} and next ${next} got ${JSON.stringify(result.body.data)}`)

      return result.body
    })
  }

  async find(predicate: (value: T) => boolean): Promise<T | undefined> {
    return this.findAsync(async it => predicate(it))
  }

  async findAsync(predicate: (value: T) => Promise<boolean>): Promise<T | undefined> {
    for await (const page of this) {
      for (const element of page) {
        if (await predicate(element)) {
          return element
        }
      }
    }
  }

  async flatMap<R>(mapper: (value: T) => Promise<R>): Promise<R[]> {
    const result: R[] = []
    for await (const page of this) {
      for (const element of page) {
        result.push(await mapper(element))
      }
    }
    return result
  }

  async all(): Promise<T[]> {
    return this.flatMap(it => Promise.resolve(it))
  }
}

class PaginatedIterator<T> implements AsyncIterator<T[]> {

  private currentPage?: string = undefined

  constructor(private nextPage: (next?: string) => Promise<SpacePaginatedResult<T>>) {

  }

  async next(...args: [] | [undefined]): Promise<IteratorResult<T[]>> {
    const result = await this.nextPage(this.currentPage)
    const done = this.currentPage == result.next
    this.currentPage = result.next
    return Promise.resolve({value: result.data, done})
  }
}

export const client = new SpaceClient();
