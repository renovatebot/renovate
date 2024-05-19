import type { MergeStrategy } from '../../../config/types';
import { logger } from '../../../logger';
import type { BranchStatus } from '../../../types';
import type {
  CreatePRConfig,
  FindPRConfig,
  Pr,
  UpdatePrConfig,
} from '../types';
import type { SpaceClient } from './client';
import type { SpaceMergeRequestRecordPredicate } from './client/code-review-read';
import type {
  CodeReviewStateFilter,
  SpaceChannelItemRecord,
  SpaceCodeReviewCreateRequest,
  SpaceJobExecutionDTO,
  SpaceMergeRequestRecord,
  SpaceRepositoryDetails,
} from './types';
import { mapSpaceCodeReviewDetailsToPr } from './utils';

export class SpaceDao {
  constructor(private client: SpaceClient) {}

  async findRepositories(): Promise<string[]> {
    const repos = await this.client.repository.getAll();
    return repos.map((it) => `${it.projectKey}/${it.repository}`);
  }

  async getRepositoryInfo(
    projectKey: string,
    repository: string,
  ): Promise<SpaceRepositoryDetails> {
    return await this.client.repository.getByName(projectKey, repository);
  }

  async createMergeRequest(
    projectKey: string,
    repository: string,
    config: CreatePRConfig,
  ): Promise<Pr> {
    const request: SpaceCodeReviewCreateRequest = {
      repository,
      sourceBranch: config.sourceBranch,
      targetBranch: config.targetBranch,
      title: config.prTitle,
      description: config.prBody,
    };

    const response = await this.client.codeReview.write.create(
      projectKey,
      request,
    );
    return mapSpaceCodeReviewDetailsToPr(response, config.prBody);
  }

  async findAllMergeRequests(
    projectKey: string,
    repository: string,
  ): Promise<Pr[]> {
    logger.debug(`SPACE: searching for PRs in ${projectKey}/${repository}`);
    const mergeRequests = await this.client.codeReview.read.find(projectKey, {
      prState: 'null',
      repository,
    });

    const result: Pr[] = [];
    for (const mergeRequest of mergeRequests) {
      const body = await this.findMergeRequestBody(mergeRequest.id);
      result.push(
        mapSpaceCodeReviewDetailsToPr(mergeRequest, body ?? DEFAULT_PR_BODY),
      );
    }

    logger.debug(`SPACE: found ${result.length} PRs`);
    return result;
  }

  async findMergeRequest(
    projectKey: string,
    repository: string,
    config: FindPRConfig,
  ): Promise<Pr | null> {
    logger.debug(`SPACE: searching for PR in ${projectKey}/${repository}`);

    let prState: CodeReviewStateFilter = 'null';
    switch (config.state) {
      case 'open':
        prState = 'Opened';
        break;
      case 'closed':
        prState = 'Closed';
        break;
      case '!open':
      case 'all':
        prState = 'null';
        break;
    }

    const mergeRequests = await this.client.codeReview.read.find(projectKey, {
      prState,
      repository,
      limit: 1,
      predicate: new FindPRConfigPredicate(config),
    });

    const mergeRequest = mergeRequests.pop();
    logger.debug(`SPACE: found ${mergeRequest ? 'a' : 'no'} PR`);

    if (mergeRequest) {
      return mapSpaceCodeReviewDetailsToPr(
        mergeRequest,
        (await this.findMergeRequestBody(mergeRequest.id)) ?? DEFAULT_PR_BODY,
      );
    } else {
      return null;
    }
  }

  async getMergeRequest(
    projectKey: string,
    codeReviewNumber: number,
  ): Promise<Pr> {
    logger.debug(`SPACE getPr(${projectKey}, ${codeReviewNumber})`);
    const review = await this.client.codeReview.read.getByCodeReviewNumber(
      projectKey,
      codeReviewNumber,
    );
    return mapSpaceCodeReviewDetailsToPr(
      review,
      (await this.findMergeRequestBody(review.id)) ?? DEFAULT_PR_BODY,
    );
  }

  async findDefaultBranch(
    projectKey: string,
    repository: string,
  ): Promise<string> {
    logger.debug(`SPACE findDefaultBranch(${projectKey}, ${repository})`);

    const repoInfo = await this.client.repository.getByName(
      projectKey,
      repository,
    );
    if (repoInfo.defaultBranch) {
      const ref = repoInfo.defaultBranch.head;
      const lastSlash = ref.lastIndexOf('/');
      if (lastSlash === -1) {
        logger.debug(
          `SPACE initRepo(${repository}) - invalid default branch ${ref}`,
        );
      } else {
        return ref.substring(lastSlash + 1);
      }
    }

    return 'main';
  }

  async updateMergeRequest(
    projectKey: string,
    prConfig: UpdatePrConfig,
  ): Promise<SpaceMergeRequestRecord> {
    logger.debug(`SPACE: updating PR ${prConfig.number}`);

    const review = await this.client.codeReview.read.getByCodeReviewNumber(
      projectKey,
      prConfig.number,
    );
    if (review.title !== prConfig.prTitle) {
      logger.debug(
        `SPACE: updating PR title from ${review.title} to ${prConfig.prTitle}`,
      );
      await this.client.codeReview.write.setTitle(
        projectKey,
        review.id,
        prConfig.prTitle,
      );
    }

    if (prConfig.prBody) {
      logger.debug(`SPACE: updating PR body for ${review.id}`);
      await this.client.codeReview.write.setDescription(
        projectKey,
        review.id,
        prConfig.prBody,
      );
    }

    if (prConfig.state === 'closed') {
      logger.debug(`SPACE: closing PR ${review.id}`);
      await this.client.codeReview.write.setState(
        projectKey,
        review.id,
        'Closed',
      );
    }

    return await this.client.codeReview.read.getByCodeReviewId(
      projectKey,
      review.id,
    );
  }

  async mergeMergeRequest(
    projectKey: string,
    codeReviewNumber: number,
    strategy: MergeStrategy,
    deleteSourceBranch: boolean,
  ): Promise<void> {
    logger.debug(
      `SPACE mergeMergeRequest(${projectKey}, ${codeReviewNumber}, ${strategy}, ${deleteSourceBranch})`,
    );

    switch (strategy) {
      case 'auto':
      case 'merge-commit':
        await this.client.codeReview.write.merge(
          projectKey,
          codeReviewNumber,
          'NO_FF',
          deleteSourceBranch,
        );
        break;
      case 'fast-forward':
        await this.client.codeReview.write.merge(
          projectKey,
          codeReviewNumber,
          'FF',
          deleteSourceBranch,
        );
        break;
      case 'rebase':
        await this.client.codeReview.write.rebase(
          projectKey,
          codeReviewNumber,
          'FF',
          null,
          deleteSourceBranch,
        );
        break;
      case 'squash':
        // TODO: figure out squash message
        await this.client.codeReview.write.rebase(
          projectKey,
          codeReviewNumber,
          'NO_FF',
          'squash??',
          deleteSourceBranch,
        );
        break;
    }
  }

  async findBranchStatus(
    projectKey: string,
    repository: string,
    branch: string,
  ): Promise<BranchStatus> {
    logger.debug(
      `SPACE findBranchStatus(${projectKey}, ${repository}, ${branch})`,
    );

    const executions = await this.findLatestJobExecutions(
      projectKey,
      repository,
      branch,
    );
    if (executions.length === 0) {
      logger.debug(
        `SPACE getBranchStatus(${branch}): no executions found, setting status to yellow`,
      );
      return 'yellow';
    }

    const branchStatuses = executions.map<BranchStatus>((execution) => {
      switch (execution.status) {
        case 'FINISHED':
          return 'green';
        case 'FAILED':
        case 'TERMINATED':
          return 'red';
        default:
          return 'yellow';
      }
    });

    if (branchStatuses.includes('red')) {
      logger.debug(`SPACE: findBranchStatus: status is 'red'`);
      return 'red';
    } else if (branchStatuses.includes('yellow')) {
      logger.debug(`SPACE: findBranchStatus: status is 'yellow'`);
      return 'yellow';
    } else {
      logger.debug(`SPACE: findBranchStatus: status is 'green'`);
      return 'green';
    }
  }

  async getFileTextContent(
    projectKey: string,
    repository: string,
    path: string,
    commit: string = 'HEAD',
  ): Promise<string> {
    return await this.client.repository.getFileContent(
      projectKey,
      repository,
      path,
      commit,
    );
  }

  async addReviewers(
    projectKey: string,
    codeReviewNumber: number,
    usernames: string[],
  ): Promise<void> {
    logger.debug(
      `SPACE: addReviewers(${projectKey}, ${codeReviewNumber}, [${usernames.join(', ')}])`,
    );
    for (const username of usernames) {
      await this.client.codeReview.write.addReviewer(
        projectKey,
        codeReviewNumber,
        username,
        'Reviewer',
      );
    }
  }

  async addAuthors(
    projectKey: string,
    codeReviewNumber: number,
    usernames: string[],
  ): Promise<void> {
    logger.debug(
      `SPACE: addAuthors(${projectKey}, ${codeReviewNumber}, [${usernames.join(', ')}])`,
    );
    for (const username of usernames) {
      await this.client.codeReview.write.addReviewer(
        projectKey,
        codeReviewNumber,
        username,
        'Author',
      );
    }
  }

  async ensureComment(
    projectKey: string,
    codeReviewNumber: number,
    topic: string | null,
    comment: string,
  ): Promise<void> {
    logger.debug(
      `SPACE: ensureComment(${projectKey}, ${codeReviewNumber}, ${comment})`,
    );

    const review = await this.client.codeReview.read.getByCodeReviewNumber(
      projectKey,
      codeReviewNumber,
    );
    // TODO: change it to accept a predicate
    const messages = await this.client.codeReview.read.getMessages(
      review.id,
      50,
      'desc',
    );
    for (const message of messages) {
      if (message.externalId === topic && message.text === comment) {
        logger.debug(
          `SPACE: ensureComment(${projectKey}, ${codeReviewNumber}, ${comment}): message exists, doing nothing`,
        );
        return Promise.resolve();
      }
    }

    logger.debug(
      `SPACE: ensureComment(${projectKey}, ${codeReviewNumber}, ${comment}): message wasn't found, creating new one`,
    );
    await this.client.codeReview.write.addMessage(review.id, comment, topic);
  }

  async ensureCommentRemoval(
    projectKey: string,
    codeReviewNumber: number,
    topic: string | null,
    content: string | null,
  ): Promise<void> {
    logger.debug(
      `SPACE: ensureCommentRemoval(${projectKey}, ${codeReviewNumber}, ${topic}, ${content})`,
    );

    const review = await this.client.codeReview.read.getByCodeReviewNumber(
      projectKey,
      codeReviewNumber,
    );
    const messages = await this.client.codeReview.read.getMessages(
      review.id,
      50,
      'desc',
    );

    let foundMessage: SpaceChannelItemRecord | undefined = undefined;
    for (const message of messages) {
      if (topic && message.externalId === topic) {
        foundMessage = message;
        break;
      }

      if (content && message.text === content) {
        foundMessage = message;
        break;
      }
    }

    if (!foundMessage) {
      logger.debug(
        `SPACE: ensureCommentRemoval(${projectKey}, ${codeReviewNumber}, ${topic}, ${content}): matching message not found`,
      );
      return Promise.resolve();
    }

    await this.client.codeReview.write.deleteMessage(
      review.id,
      foundMessage.id,
    );
  }

  private async findLatestJobExecutions(
    projectKey: string,
    repository: string,
    branch: string,
  ): Promise<SpaceJobExecutionDTO[]> {
    logger.debug(
      `SPACE findLatestJobExecutions(${projectKey}, ${repository}, ${branch})`,
    );

    const allRepositoryHead = await this.client.repository.getBranchesHeads(
      projectKey,
      repository,
    );

    const repositoryHead = allRepositoryHead.find(
      (it) => it.head === `refs/heads/${branch}`,
    )!;
    logger.debug(
      `SPACE findLatestJobExecutions(${projectKey}, ${repository}, ${branch}), head: ${JSON.stringify(repositoryHead)}`,
    );
    const jobs = await this.client.jobs.getAll(projectKey, repository, branch);

    logger.debug(
      `SPACE findLatestJobExecutions(${projectKey}, ${repository}, ${branch}) found ${jobs.length} jobs`,
    );

    const result: SpaceJobExecutionDTO[] = [];
    for (const job of jobs) {
      const executions = await this.client.jobs.findJobExecutions(
        projectKey,
        job.id,
        branch,
        (dto) => dto.commitId === repositoryHead.ref,
        1,
      );
      logger.debug(
        `SPACE findLatestJobExecutions(${projectKey}, ${repository}, ${branch}) job ${job.id} found executions: ${executions.length}`,
      );

      result.push(...executions);
    }

    logger.debug(
      `SPACE findLatestJobExecutions(${projectKey}, ${repository}, ${branch}): total executions ${result.length}`,
    );

    return result;
  }

  private async findMergeRequestBody(
    codeReviewId: string,
  ): Promise<string | undefined> {
    logger.debug(`SPACE: searching for PR body in ${codeReviewId}`);
    const messages = await this.client.codeReview.read.getMessages(
      codeReviewId,
      1,
      'asc',
    );
    if (messages.length === 0) {
      logger.debug(`SPACE: found no messages in PR ${codeReviewId}`);
      return undefined;
    }

    const body = messages.pop()?.details?.description?.text;
    logger.debug(
      `SPACE: found PR body in ${codeReviewId} of length ${body?.length}`,
    );
    return body;
  }
}

export class FindPRConfigPredicate implements SpaceMergeRequestRecordPredicate {
  private allButOpen: boolean;

  constructor(private config: FindPRConfig) {
    this.allButOpen = config.state === '!open';
  }

  test(pr: SpaceMergeRequestRecord): Promise<boolean> {
    if (this.allButOpen && pr.state === 'Opened') {
      logger.info(
        `SPACE: stateFilter=${this.config.state}. Ignoring PR ${pr.title} because it is open`,
      );
      return Promise.resolve(false);
    }

    // TODO: figure out what is the case here
    if (pr.branchPairs.length !== 1) {
      logger.debug(
        `SPACE: Not sure what to do with not a single branch pair in PR ${pr.title}`,
      );
      return Promise.resolve(false);
    }

    if (pr.branchPairs[0].sourceBranch !== this.config.branchName) {
      logger.debug(
        `SPACE: branchFilter=${this.config.branchName}. Ignoring PR ${pr.title} because it doesn't match the branch`,
      );
      return Promise.resolve(false);
    }

    if (this.config.prTitle && pr.title !== this.config.prTitle) {
      return Promise.resolve(false);
    }

    logger.debug(
      `SPACE: branchFilter=${this.config.branchName}. found PR ${pr.title} with state ${pr.state}`,
    );
    return Promise.resolve(true);
  }
}

const DEFAULT_PR_BODY = 'no pr body';
