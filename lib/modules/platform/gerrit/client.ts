import { REPOSITORY_ARCHIVED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider';
import { GerritHttp } from '../../../util/http/gerrit';
import type { HttpOptions } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { getQueryString } from '../../../util/url';
import type {
  GerritAccountInfo,
  GerritBranchInfo,
  GerritChange,
  GerritChangeMessageInfo,
  GerritFindPRConfig,
  GerritMergeableInfo,
  GerritProjectInfo,
} from './types';
import { mapPrStateToGerritFilter } from './utils';

const QUOTES_REGEX = regEx('"', 'g');

class GerritClient {
  private requestDetails = [
    'SUBMITTABLE', //include the submittable field in ChangeInfo, which can be used to tell if the change is reviewed and ready for submit.
    'CHECK', // include potential consistency problems with the change (not related to labels)
    'MESSAGES',
    'DETAILED_ACCOUNTS',
    'LABELS',
    'CURRENT_ACTIONS', //to check if current_revision can be "rebased"
    'CURRENT_REVISION', //get RevisionInfo::ref to fetch
    'CURRENT_COMMIT', // to get the commit message
  ] as const;

  private gerritHttp = new GerritHttp();

  async getRepos(): Promise<string[]> {
    const res = await this.gerritHttp.getJsonUnchecked<string[]>(
      'a/projects/?type=CODE&state=ACTIVE',
      {},
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
    refreshCache?: boolean,
  ): Promise<GerritChange[]> {
    const opts: HttpOptions = {};
    /* v8 ignore start: temporary code */
    // TODO: should refresh the cache rather than just ignore it
    if (refreshCache) {
      opts.memCache = false;
    } else {
      opts.cacheProvider = memCacheProvider;
    }
    /* v8 ignore stop */

    const filters = GerritClient.buildSearchFilters(repository, findPRConfig);
    const queryString = getQueryString({
      o: this.requestDetails,
    });
    const changes = await this.gerritHttp.getJsonUnchecked<GerritChange[]>(
      `a/changes/?q=${filters.join('+')}&${queryString}`,
      opts,
    );
    logger.trace(
      `findChanges(${filters.join(', ')}) => ${changes.body.length}`,
    );
    return changes.body;
  }

  async getChange(changeNumber: number): Promise<GerritChange> {
    const queryString = getQueryString({ o: this.requestDetails });
    const changes = await this.gerritHttp.getJsonUnchecked<GerritChange>(
      `a/changes/${changeNumber}?${queryString}`,
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

  async abandonChange(changeNumber: number): Promise<void> {
    await this.gerritHttp.postJson(`a/changes/${changeNumber}/abandon`);
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
    await this.gerritHttp.postJson(
      `a/changes/${changeNumber}/revisions/current/review`,
      { body: { labels: { [label]: value }, notify: 'NONE' } },
    );
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
    const filterState = mapPrStateToGerritFilter(searchConfig.state);
    const filters = ['owner:self', 'project:' + repository, filterState];
    if (searchConfig.branchName) {
      filters.push(`footer:Renovate-Branch=${searchConfig.branchName}`);
    }
    if (searchConfig.targetBranch) {
      filters.push(`branch:${searchConfig.targetBranch}`);
    }
    if (searchConfig.label) {
      filters.push(`label:Code-Review=${searchConfig.label}`);
    }
    if (searchConfig.prTitle) {
      // escaping support in Gerrit is not great, so we need to remove quotes
      // special characters are ignored anyway in the search so it does not create any issues
      filters.push(
        `message:${encodeURIComponent('"' + searchConfig.prTitle.replace(QUOTES_REGEX, '') + '"')}`,
      );
    }
    return filters;
  }
}

export const client = new GerritClient();
