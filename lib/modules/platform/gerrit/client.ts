import { atob } from 'buffer';
import { REPOSITORY_ARCHIVED } from '../../../constants/error-messages';
import { GerritHttp } from '../../../util/http/gerrit';
import type {
  GerritAccountInfo,
  GerritBranchInfo,
  GerritChange,
  GerritChangeMessageInfo,
  GerritMergeableInfo,
  GerritProjectInfo,
} from './types';

export class GerritClient {
  requestDetails = [
    'SUBMITTABLE', //include the submittable field in ChangeInfo, which can be used to tell if the change is reviewed and ready for submit.
    'CHECK', // include potential problems with the change.
    'MESSAGES',
    'DETAILED_ACCOUNTS',
    'LABELS',
    'CURRENT_ACTIONS', //to check if current_revision can be "rebase"
    'CURRENT_REVISION', //get RevisionInfo::ref to fetch
  ];

  gerritHttp = new GerritHttp();

  async getRepos(): Promise<string[]> {
    const res = await this.gerritHttp.getJson<string[]>(
      'a/projects/?type=CODE&state=ACTIVE',
      {}
    );
    return Promise.resolve(Object.keys(res.body));
  }

  async getProjectInfo(repository: string): Promise<GerritProjectInfo> {
    const projectInfo = await this.gerritHttp.getJson<GerritProjectInfo>(
      `a/projects/${encodeURIComponent(repository)}`
    );
    if (projectInfo.body.state !== 'ACTIVE') {
      throw new Error(REPOSITORY_ARCHIVED);
    }
    return projectInfo.body;
  }

  async getBranchInfo(repository: string): Promise<GerritBranchInfo> {
    const branchInfo = await this.gerritHttp.getJson<GerritBranchInfo>(
      `a/projects/${encodeURIComponent(repository)}/branches/HEAD`
    );
    return branchInfo.body;
  }

  async findChanges(
    filter: string[],
    refreshCache?: boolean
  ): Promise<GerritChange[]> {
    const changes = await this.gerritHttp.getJson<GerritChange[]>(
      `a/changes/?q=` +
        filter.filter((s) => typeof s !== 'undefined').join('+') +
        this.requestDetails.map((det) => '&o=' + det).join(''),
      { useCache: !refreshCache }
    );
    return changes.body;
  }

  async getChange(changeNumber: number): Promise<GerritChange> {
    const changes = await this.gerritHttp.getJson<GerritChange>(
      `a/changes/${changeNumber}` //TODO: add requestDetails options
    );
    return changes.body;
  }

  async getChangeDetails(changeNumber: number): Promise<GerritChange> {
    const change = await this.gerritHttp.getJson<GerritChange>(
      `a/changes/${changeNumber}/detail`,
      { useCache: false }
    );
    return change.body;
  }

  async getMergeableInfo(change: GerritChange): Promise<GerritMergeableInfo> {
    const mergeable = await this.gerritHttp.getJson<GerritMergeableInfo>(
      `a/changes/${change._number}/revisions/current/mergeable`
    );
    return mergeable.body;
  }

  async abandonChange(changeNumber: number): Promise<void> {
    await this.gerritHttp.postJson(`a/changes/${changeNumber}/abandon`);
  }

  async submitChange(changeNumber: number): Promise<GerritChange> {
    const change = await this.gerritHttp.postJson<GerritChange>(
      `a/changes/${changeNumber}/submit`
    );
    return change.body;
  }

  async setCommitMessage(changeNumber: number, message: string): Promise<void> {
    await this.gerritHttp.putJson(`a/changes/${changeNumber}/message`, {
      body: { message },
    });
  }

  async getMessages(changeNumber: number): Promise<GerritChangeMessageInfo[]> {
    const messages = await this.gerritHttp.getJson<GerritChangeMessageInfo[]>(
      `a/changes/${changeNumber}/messages`,
      { useCache: false }
    );
    return messages.body;
  }

  async addMessage(
    changeNumber: number,
    message: string,
    tag?: string
  ): Promise<void> {
    await this.gerritHttp.postJson(
      `a/changes/${changeNumber}/revisions/current/review`,
      { body: { message, tag } }
    );
  }

  async setLabel(
    changeNumber: number,
    label: string,
    value: number
  ): Promise<void> {
    await this.gerritHttp.postJson(
      `a/changes/${changeNumber}/revisions/current/review`,
      { body: { labels: { [label]: value } } }
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
      }
    );
  }

  async getFile(
    repo: string,
    branch: string,
    fileName: string
  ): Promise<string> {
    const base64Content = await this.gerritHttp.get(
      `a/projects/${encodeURIComponent(
        repo
      )}/branches/${branch}/files/${encodeURIComponent(fileName)}/content`
    );
    return Promise.resolve(atob(base64Content.body)); //TODO: switch to Buffer.from...
  }
}

export const client = new GerritClient();
