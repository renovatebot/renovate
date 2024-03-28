import {logger} from "../../../logger";
import type {PrState} from "../../../types";
import {hashBody} from "../pr-body";
import type {CreatePRConfig, FindPRConfig, Pr} from "../types";
import type {SpaceClient} from "./client";
import type {
  CodeReviewStateFilter,
  SpaceCodeReviewCreateRequest,
  SpaceCodeReviewState,
  SpaceMergeRequestRecord,
  SpaceRepositoryDetails
} from "./types";

export class SpaceDao {
  constructor(private client: SpaceClient) {
  }

  async findRepositories(): Promise<string[]> {
    const repos = await this.client.findRepositories()
    return repos.map(it => `${it.projectKey}/${it.repository}`)
  }

  async getRepositoryInfo(projectKey: string, repository: string): Promise<SpaceRepositoryDetails> {
    return await this.client.getRepositoryInfo(projectKey, repository)
  }

  async findMergeRequestBody(codeReviewId: string): Promise<string | undefined> {
    const messages = await this.client.findMergeRequestMessages(codeReviewId, 1, 'asc')
    if (messages.length === 0) {
      return undefined
    }

    return messages.pop()?.details?.description?.text
  }

  async createMergeRequest(projectKey: string, repository: string, config: CreatePRConfig): Promise<Pr> {
    const request: SpaceCodeReviewCreateRequest = {
      repository,
      sourceBranch: config.sourceBranch,
      targetBranch: config.targetBranch,
      title: config.prTitle,
      description: config.prBody,
    }

    const response = await this.client.createMergeRequest(projectKey, request)
    return mapSpaceCodeReviewDetailsToPr(response, config.prBody);
  }

  async findAllMergeRequests(projectKey: string, repository: string): Promise<Pr[]> {
    logger.debug(`SPACE: searching for PRs in ${projectKey}/${repository}`)
    const mergeRequests = await this.client.findMergeRequests(projectKey, {
      prState: 'null',
      repository,
    })

    const result: Pr[] = []
    for (const mergeRequest of mergeRequests) {
      const body = await this.findMergeRequestBody(mergeRequest.id)
      result.push(mapSpaceCodeReviewDetailsToPr(mergeRequest, body ?? 'no pr body'))
    }

    logger.debug(`SPACE: found ${result.length} PRs`)
    return result
  }

  async findMergeRequest(projectKey: string, repository: string, config: FindPRConfig): Promise<Pr | null> {
    logger.debug(`SPACE: searching for PR in ${projectKey}/${repository}`)

    let prState: CodeReviewStateFilter = 'null'
    const allButOpen = config.state === '!open'
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

    const mergeRequests = await this.client.findMergeRequests(projectKey, {
      prState,
      repository,
      limit: 1,
      predicate: review => {
        if (allButOpen && review.state === 'Opened') {
          logger.info(`SPACE: stateFilter=${config.state}. Ignoring PR ${review.title} because it is open`)
          return Promise.resolve(false)
        }

        // TODO: figure out what is the case here
        if (review.branchPairs.length !== 1) {
          logger.debug(`SPACE: Not sure what to do with not a single branch pair in PR ${review.title}`)
          return Promise.resolve(false)
        }

        if (review.branchPairs[0].sourceBranch !== config.branchName) {
          logger.debug(`SPACE: branchFilter=${config.branchName}. Ignoring PR ${review.title} because it doesn't match the branch`)
          return Promise.resolve(false)
        }

        if (config.prTitle && review.title !== config.prTitle) {
          return Promise.resolve(false)
        }

        logger.debug(`SPACE: branchFilter=${config.branchName}. found PR ${review.title} with state ${review.state}`)
        return Promise.resolve(true)
      }
    })

    const mergeRequest = mergeRequests.pop()
    logger.debug(`SPACE: found ${mergeRequest ? 'a' : 'no'} PR`)

    if (mergeRequest) {
      return mapSpaceCodeReviewDetailsToPr(mergeRequest, await this.findMergeRequestBody(mergeRequest.id) ?? 'no pr body')
    } else {
      return null
    }
  }
}

function mapSpaceCodeReviewDetailsToPr(details: SpaceMergeRequestRecord, body: string): Pr {
  return {
    number: details.number,
    state: mapSpaceCodeReviewStateToPrState(details.state, details.canBeReopened ?? false),
    sourceBranch: details.branchPairs[0].sourceBranch,
    targetBranch: details.branchPairs[0].targetBranch,
    title: details.title,
    // reviewers:
    //   change.reviewers?.REVIEWER?.filter(
    //     (reviewer) => typeof reviewer.username === 'string',
    //   ).map((reviewer) => reviewer.username!) ?? [],
    // TODO: find how to retrieve pr description?
    bodyStruct: {
      hash: hashBody(body),
    },
  };
}

function mapSpaceCodeReviewStateToPrState(
  state: SpaceCodeReviewState, canBeReopened: boolean
): PrState {
  switch (state) {
    case 'Opened':
      return 'open';
    case 'Closed':
      if (canBeReopened) {
        return 'closed';
      } else {
        return 'merged';
      }
    case "Deleted":
      // should not normally be here
      return 'closed';
  }
  return 'all';
}
