import { REPOSITORY_ARCHIVED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider';
import { GerritHttp } from '../../../util/http/gerrit';
import type { HttpOptions } from '../../../util/http/types';
import { getQueryString } from '../../../util/url';
import type {
  GerritAccountInfo,
  GerritBranchInfo,
  GerritChange,
  GerritChangeMessageInfo,
  GerritFindPRConfig,
  GerritMergeableInfo,
  GerritProjectInfo,
  GerritRequestDetail,
} from './types';
import { mapPrStateToGerritFilter } from './utils';

class GerritClient {
  private gerritHttp = new GerritHttp();

  async getRepos(): Promise<string[]> {
    const res = await this.gerritHttp.getJsonUnchecked<string[]>(
      'a/projects/?type=CODE&state=ACTIVE',
    );
    return Object.keys(res.body);
  }

  async getProjectInfo(repository: string): Promise<GerritProjectInfo> {
    const projectInfo =
      await this.gerritHttp.getJsonUnchecked<GerritProjectInfo>(
        `a/projects/${encodeURIComponent(repository)}`,
      );
    if (projectInfo.body.state !== 'ACTIVE') {
      throw new Error(REPOSITORY_ARCHIVED);
    }
    return projectInfo.body;
  }

  async getBranchInfo(repository: string): Promise<GerritBranchInfo> {
    const branchInfo = await this.gerritHttp.getJsonUnchecked<GerritBranchInfo>(
      `a/projects/${encodeURIComponent(repository)}/branches/HEAD`,
    );
    return branchInfo.body;
  }

  async findChanges(
    repository: string,
    findPRConfig: GerritFindPRConfig,
  ): Promise<GerritChange[]> {
    /* v8 ignore start: temporary code */
    // Disables memCache (enabled by default) to be replaced by memCacheProvider
    const opts: HttpOptions = { memCache: false };
    // TODO: should refresh the cache rather than just ignore it
    if (!findPRConfig.refreshCache) {
      opts.cacheProvider = memCacheProvider;
    }
    /* v8 ignore stop */

    const query: Record<string, any> = {};
    if (findPRConfig.requestDetails) {
      query.o = findPRConfig.requestDetails;
    }
    if (findPRConfig.limit) {
      query.n = findPRConfig.limit;
    } else {
      // TODO: handle pagination instead
      query['no-limit'] = true;
    }
    const filters = GerritClient.buildSearchFilters(repository, findPRConfig);
    const queryString = `q=${filters.join('+')}&${getQueryString(query)}`;
    const changes = await this.gerritHttp.getJsonUnchecked<GerritChange[]>(
      `a/changes/?${queryString}`,
      opts,
    );
    logger.trace(`findChanges(${queryString}) => ${changes.body.length}`);
    return changes.body;
  }

  async getChange(
    changeNumber: number,
    refreshCache?: boolean,
    requestDetails?: GerritRequestDetail[],
  ): Promise<GerritChange> {
    /* v8 ignore start: temporary code */
    // Disables memCache (enabled by default) to be replaced by memCacheProvider
    const opts: HttpOptions = { memCache: false };
    // TODO: should refresh the cache rather than just ignore it
    if (!refreshCache) {
      opts.cacheProvider = memCacheProvider;
    }
    /* v8 ignore stop */

    const queryString = getQueryString({ o: requestDetails });
    const changes = await this.gerritHttp.getJsonUnchecked<GerritChange>(
      `a/changes/${changeNumber}?${queryString}`,
      opts,
    );
    return changes.body;
  }

  async getMergeableInfo(change: GerritChange): Promise<GerritMergeableInfo> {
    const mergeable =
      await this.gerritHttp.getJsonUnchecked<GerritMergeableInfo>(
        `a/changes/${change._number}/revisions/current/mergeable`,
      );
    return mergeable.body;
  }

  async abandonChange(changeNumber: number, message?: string): Promise<void> {
    await this.gerritHttp.postJson(`a/changes/${changeNumber}/abandon`, {
      body: {
        message,
        notify: 'OWNER_REVIEWERS', // Avoids notifying cc's
      },
    });
  }

  async submitChange(changeNumber: number): Promise<GerritChange> {
    const change = await this.gerritHttp.postJson<GerritChange>(
      `a/changes/${changeNumber}/submit`,
    );
    return change.body;
  }

  async getMessages(changeNumber: number): Promise<GerritChangeMessageInfo[]> {
    const messages = await this.gerritHttp.getJsonUnchecked<
      GerritChangeMessageInfo[]
    >(`a/changes/${changeNumber}/messages`, { memCache: false });
    return messages.body;
  }

  async addMessage(
    changeNumber: number,
    fullMessage: string,
    tag?: string,
  ): Promise<void> {
    const message = this.normalizeMessage(fullMessage);
    await this.gerritHttp.postJson(
      `a/changes/${changeNumber}/revisions/current/review`,
      { body: { message, tag, notify: 'NONE' } },
    );
  }

  async checkForExistingMessage(
    changeNumber: number,
    newMessage: string,
    msgType?: string,
    messages?: GerritChangeMessageInfo[],
  ): Promise<boolean> {
    const messagesToSearch = messages ?? (await this.getMessages(changeNumber));

    return messagesToSearch.some(
      (existingMsg) =>
        (msgType === undefined || msgType === existingMsg.tag) &&
        existingMsg.message.includes(newMessage),
    );
  }

  async addMessageIfNotAlreadyExists(
    changeNumber: number,
    message: string,
    tag?: string,
    messages?: GerritChangeMessageInfo[],
  ): Promise<void> {
    const newMsg = this.normalizeMessage(message);
    if (
      !(await this.checkForExistingMessage(changeNumber, newMsg, tag, messages))
    ) {
      await this.addMessage(changeNumber, newMsg, tag);
    }
  }

  async setLabel(
    changeNumber: number,
    label: string,
    value: number,
  ): Promise<void> {
    await this.gerritHttp.postJson(
      `a/changes/${changeNumber}/revisions/current/review`,
      { body: { labels: { [label]: value }, notify: 'NONE' } },
    );
  }

  async deleteHashtag(changeNumber: number, hashtag: string): Promise<void> {
    await this.gerritHttp.postJson(`a/changes/${changeNumber}/hashtags`, {
      body: { remove: [hashtag] },
    });
  }

  async addReviewers(changeNumber: number, reviewers: string[]): Promise<void> {
    await this.gerritHttp.postJson(
      `a/changes/${changeNumber}/revisions/current/review`,
      {
        body: {
          reviewers: reviewers.map((r) => ({ reviewer: r })),
          notify: 'OWNER_REVIEWERS', // Avoids notifying cc's
        },
      },
    );
  }

  async addAssignee(changeNumber: number, assignee: string): Promise<void> {
    await this.gerritHttp.putJson<GerritAccountInfo>(
      // TODO: refactor this as this API removed in Gerrit 3.8
      `a/changes/${changeNumber}/assignee`,
      {
        body: { assignee },
      },
    );
  }

  async getFile(
    repo: string,
    branch: string,
    fileName: string,
  ): Promise<string> {
    const base64Content = await this.gerritHttp.getText(
      `a/projects/${encodeURIComponent(
        repo,
      )}/branches/${encodeURIComponent(branch)}/files/${encodeURIComponent(fileName)}/content`,
    );
    return Buffer.from(base64Content.body, 'base64').toString();
  }

  normalizeMessage(message: string): string {
    //the last \n was removed from gerrit after the comment was added...
    return message.substring(0, 0x4000).trim();
  }

  private static buildSearchFilters(
    repository: string,
    searchConfig: GerritFindPRConfig,
  ): string[] {
    const filters = [
      'owner:self',
      `project:${repository}`,
      '-is:wip',
      '-is:private',
    ];
    const filterState = mapPrStateToGerritFilter(searchConfig.state);
    if (filterState) {
      filters.push(filterState);
    }
    if (searchConfig.branchName) {
      filters.push(`footer:Renovate-Branch=${searchConfig.branchName}`);
    }
    // TODO: Use Gerrit 3.6+ hasfooter:Renovate-Branch when branchName is empty:
    //   https://gerrit-review.googlesource.com/c/gerrit/+/329488
    if (searchConfig.targetBranch) {
      filters.push(`branch:${searchConfig.targetBranch}`);
    }
    if (searchConfig.label) {
      filters.push(`label:Code-Review=${searchConfig.label}`);
    }
    if (searchConfig.prTitle) {
      // Quotes in the commit message must be escaped with a backslash:
      //   https://gerrit-review.googlesource.com/Documentation/user-search.html#search-operators
      // TODO: Use Gerrit 3.8+ subject query instead:
      //   https://gerrit-review.googlesource.com/c/gerrit/+/354037
      filters.push(
        `message:${encodeURIComponent('"' + searchConfig.prTitle.replaceAll('"', '\\"') + '"')}`,
      );
    }
    return filters;
  }
}

export const client = new GerritClient();
