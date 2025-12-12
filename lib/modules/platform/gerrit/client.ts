import semver from 'semver';
import { z } from 'zod';
import { REPOSITORY_ARCHIVED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { GerritHttp } from '../../../util/http/gerrit';
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
import {
  MAX_GERRIT_COMMENT_SIZE,
  MIN_GERRIT_VERSION,
  mapPrStateToGerritFilter,
} from './utils';

class GerritClient {
  // memCache is disabled because GerritPrCache will provide a smarter caching
  private gerritHttp = new GerritHttp({ memCache: false });
  private gerritVersion = MIN_GERRIT_VERSION;

  setGerritVersion(version: string): void {
    this.gerritVersion = version;
  }

  async getGerritVersion(): Promise<string> {
    const res = await this.gerritHttp.getJson(
      'a/config/server/version',
      z.string(),
    );
    return res.body;
  }

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

  async getBranchChange(
    repository: string,
    config: Pick<
      GerritFindPRConfig,
      'branchName' | 'state' | 'targetBranch' | 'requestDetails'
    >,
  ): Promise<GerritChange | null> {
    const changes = await this.findChanges(repository, {
      branchName: config.branchName,
      state: config.state,
      singleChange: config.targetBranch ? false : true,
      requestDetails: config.requestDetails,
    });

    if (changes.length === 0) {
      return null;
    }

    if (changes.length === 1) {
      return changes[0];
    }

    // If multiple changes are found, prefer the one matching the target branch
    if (config.targetBranch) {
      const change = changes.find((c) => c.branch === config.targetBranch);
      if (change) {
        return change;
      }
    }

    // Otherwise return the first one
    return changes[0];
  }

  async findChanges(
    repository: string,
    findPRConfig: GerritFindPRConfig,
  ): Promise<GerritChange[]> {
    const startOffset = findPRConfig.startOffset ?? 0;
    const pageLimit = findPRConfig.singleChange
      ? 1
      : (findPRConfig.pageLimit ?? 50);

    const query: Record<string, any> = {
      n: pageLimit,
    };
    if (findPRConfig.requestDetails) {
      query.o = findPRConfig.requestDetails;
    }

    const filters = this.buildSearchFilters(repository, findPRConfig);

    const allChanges: GerritChange[] = [];

    while (true) {
      query.S = allChanges.length + startOffset;
      const queryString = `q=${filters.join('+')}&${getQueryString(query)}`;
      const changes = await this.gerritHttp.getJsonUnchecked<GerritChange[]>(
        `a/changes/?${queryString}`,
      );

      logger.trace(
        `findChanges(${queryString},start=${query.S},limit=${query.n}) => ${changes.body.length}`,
      );

      const lastChange = changes.body.at(-1);
      let hasMoreChanges = false;
      if (lastChange?._more_changes) {
        hasMoreChanges = true;
        delete lastChange._more_changes;
      }

      allChanges.push(...changes.body);

      if (
        findPRConfig.singleChange ||
        findPRConfig.noPagination ||
        !hasMoreChanges
      ) {
        break;
      }
    }

    return allChanges;
  }

  async getChange(
    changeNumber: number,
    requestDetails?: GerritRequestDetail[],
  ): Promise<GerritChange> {
    const queryString = getQueryString({ o: requestDetails });
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
    >(`a/changes/${changeNumber}/messages`);
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
    const messagesToSearch = await this.getMessages(changeNumber);

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

  async moveChange(
    changeNumber: number,
    destinationBranch: string,
  ): Promise<GerritChange> {
    const change = await this.gerritHttp.postJson<GerritChange>(
      `a/changes/${changeNumber}/move`,
      {
        body: {
          destination_branch: destinationBranch,
        },
      },
    );
    return change.body;
  }

  normalizeMessage(message: string): string {
    // Gerrit would trim it anyway
    let msg = message.trim();

    const encoder = new TextEncoder();
    const bytes = encoder.encode(msg);
    if (bytes.length > MAX_GERRIT_COMMENT_SIZE) {
      const truncationNotice = '\n\n[Truncated by Renovate]';
      const truncationNoticeBytes = encoder.encode(truncationNotice);
      const maxContentBytes =
        MAX_GERRIT_COMMENT_SIZE - truncationNoticeBytes.length;
      const truncatedBytes = bytes.slice(0, maxContentBytes);
      const decoded = new TextDecoder().decode(truncatedBytes);
      msg = decoded + truncationNotice;
    }

    return msg;
  }

  private buildSearchFilters(
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
    } else if (semver.gte(this.gerritVersion, '3.6.0')) {
      filters.push('hasfooter:Renovate-Branch');
    } else {
      filters.push('message:"Renovate-Branch: "');
    }
    if (searchConfig.targetBranch) {
      filters.push(`branch:${searchConfig.targetBranch}`);
    }
    if (searchConfig.label) {
      filters.push(`label:Code-Review=${searchConfig.label}`);
    }
    if (searchConfig.prTitle) {
      // Quotes in the search operators must be escaped with a backslash:
      //   https://gerrit-review.googlesource.com/Documentation/user-search.html#search-operators
      const escapedTitle = searchConfig.prTitle.replaceAll('"', '\\"');
      if (semver.gte(this.gerritVersion, '3.8.0')) {
        filters.push(`subject:"${escapedTitle}"`);
      } else {
        filters.push(`message:"${escapedTitle}"`);
      }
    }
    return filters;
  }
}

export const client = new GerritClient();
