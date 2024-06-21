import { REPOSITORY_ARCHIVED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { GerritHttp } from '../../../util/http/gerrit';
import { regEx } from '../../../util/regex';
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
    'CHECK', // include potential problems with the change.
    'MESSAGES',
    'DETAILED_ACCOUNTS',
    'LABELS',
    'CURRENT_ACTIONS', //to check if current_revision can be "rebased"
    'CURRENT_REVISION', //get RevisionInfo::ref to fetch
  ] as const;

  private gerritHttp = new GerritHttp();

  async getRepos(): Promise<string[]> {
    const res = await this.gerritHttp.getJson<string[]>(
      'a/projects/?type=CODE&state=ACTIVE',
      {},
    );
    return Object.keys(res.body);
  }

  async getProjectInfo(repository: string): Promise<GerritProjectInfo> {
    const projectInfo = await this.gerritHttp.getJson<GerritProjectInfo>(
      `a/projects/${encodeURIComponent(repository)}`,
    );
    if (projectInfo.body.state !== 'ACTIVE') {
      throw new Error(REPOSITORY_ARCHIVED);
    }
    return projectInfo.body;
  }

  async getBranchInfo(repository: string): Promise<GerritBranchInfo> {
    const branchInfo = await this.gerritHttp.getJson<GerritBranchInfo>(
      `a/projects/${encodeURIComponent(repository)}/branches/HEAD`,
    );
    return branchInfo.body;
  }

  async findChanges(
    repository: string,
    findPRConfig: GerritFindPRConfig,
    refreshCache?: boolean,
  ): Promise<GerritChange[]> {
    const filters = GerritClient.buildSearchFilters(repository, findPRConfig);
    const changes = await this.gerritHttp.getJson<GerritChange[]>(
      `a/changes/?q=` +
        filters.join('+') +
        this.requestDetails.map((det) => `&o=${det}`).join(''),
      { memCache: !refreshCache },
    );
    logger.trace(
      `findChanges(${filters.join(', ')}) => ${changes.body.length}`,
    );
    return changes.body;
  }

  async getChange(changeNumber: number): Promise<GerritChange> {
    const changes = await this.gerritHttp.getJson<GerritChange>(
      `a/changes/${changeNumber}?` +
        this.requestDetails.map((det) => `o=${det}`).join('&'),
    );
    return changes.body;
  }

  async getMergeableInfo(change: GerritChange): Promise<GerritMergeableInfo> {
    const mergeable = await this.gerritHttp.getJson<GerritMergeableInfo>(
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

  async setCommitMessage(changeNumber: number, message: string): Promise<void> {
    await this.gerritHttp.putJson(`a/changes/${changeNumber}/message`, {
      body: { message },
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
    const messages = await this.gerritHttp.getJson<GerritChangeMessageInfo[]>(
      `a/changes/${changeNumber}/messages`,
      { memCache: false },
    );
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
      { body: { message, tag } },
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
      { body: { labels: { [label]: value } } },
    );
  }

  async addReviewer(changeNumber: number, reviewer: string): Promise<void> {
    await this.gerritHttp.postJson(`a/changes/${changeNumber}/reviewers`, {
      body: { reviewer },
    });
  }

  async addAssignee(changeNumber: number, assignee: string): Promise<void> {
    await this.gerritHttp.putJson<GerritAccountInfo>(
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
    const base64Content = await this.gerritHttp.get(
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
