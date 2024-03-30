import type {SpaceHttp} from "../../../../util/http/space";
import type {
  CodeReviewStateFilter,
  SpaceChannelItem,
  SpaceChannelItemRecord,
  SpaceCodeReviewBasicInfo,
  SpaceMergeRequestRecord
} from "../types";
import {PaginatedIterable} from "../paginated-iterator";
import {mapNotNullFlatten} from "../utils";
import {logger} from "../../../../logger";

export class SpaceCodeReviewReadClient {
  constructor(private http: SpaceHttp) {
  }

  async getByCodeReviewId(projectKey: string, codeReviewId: string): Promise<SpaceMergeRequestRecord> {
    const result = await this.http.getJson<SpaceMergeRequestRecord>(`/api/http/projects/key:${projectKey}/code-reviews/id:${codeReviewId}`)
    return result.body
  }

  async getByCodeReviewNumber(projectKey: string, codeReviewNumber: number): Promise<SpaceMergeRequestRecord> {
    const result = await this.http.getJson<SpaceMergeRequestRecord>(`/api/http/projects/key:${projectKey}/code-reviews/number:${codeReviewNumber}`)
    return result.body
  }

  async find(
    projectKey: string,
    partialConfig: Partial<FindConfig> = {}
  ): Promise<SpaceMergeRequestRecord[]> {
    const config: FindConfig = {
      prState: 'null',
      predicate: () => Promise.resolve(true),
      ...partialConfig
    }

    let repositoryQueryParam = ''
    if (config.repository) {
      repositoryQueryParam = `&repository=${config.repository}`
    }

    const iterable = PaginatedIterable.fromGetUsingSkip<SpaceCodeReviewBasicInfo>(
      this.http, `/api/http/projects/key:${projectKey}/code-reviews?$top=1&state=${config.prState}${repositoryQueryParam}`
    )

    return await mapNotNullFlatten(iterable, async basicReview => {
      // not sure what is this, but doesn't look like a renovate one
      if (basicReview.review.className === 'CommitSetReviewRecord') {
        return undefined
      }

      const review = await this.getByCodeReviewId(projectKey, basicReview.review.id)
      if (review.state === 'Deleted') {
        // should not normally be returned, but who knows
        logger.info(`SPACE: Ignoring PR ${review.title} because it is deleted`)
        return undefined
      }

      const accept = await config.predicate(review)
      return accept ? review : undefined
    }, config.limit)
  }

  async getMessages(codeReviewId: string, limit: number, order: 'asc' | 'desc'): Promise<SpaceChannelItemRecord[]> {
    logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId}, limit=${limit}, order=${order}`)

    const apiOrder = order === 'asc' ? 'FromOldestToNewest' : 'FromNewestToOldest'

    const iterable = PaginatedIterable.fromUsing<SpaceChannelItem>(this.http, `/api/http/chats/messages?channel=codeReview:id:${codeReviewId}&sorting=${apiOrder}&batchSize=${limit}`, {
      queryParameter: 'startFromDate',
      dataField: it => it.messages,
      nextField: it => it.nextStartFromDate.iso
    })

    const result = await mapNotNullFlatten(iterable, async channelItem => {
      const id = channelItem.id

      logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId} fetching message id=${id}`)

      const message = await this.http.getJson<SpaceChannelItemRecord>(`/api/http/chats/messages/id:${id}?channel=codeReview:id:${codeReviewId}`)
      logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId} message = ${message.body.time}`)

      return message.body
    })

    logger.debug(`SPACE: findMergeRequestBody: codeReviewId=${codeReviewId} found ${result.length} messages`)
    return result
  }
}

interface FindConfig {
  repository?: string;
  prState: CodeReviewStateFilter;
  predicate: (pr: SpaceMergeRequestRecord) => Promise<boolean>;
  limit?: number;
}
