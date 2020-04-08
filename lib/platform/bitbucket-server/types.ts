import GitStorage from '../git/storage';
import { Pr } from '../common';

export interface BbsConfig {
  baseBranch: string;
  bbUseDefaultReviewers: boolean;
  defaultBranch: string;
  fileList: any[];
  mergeMethod: string;
  owner: string;
  prList: BbsPr[];
  projectKey: string;
  repository: string;
  repositorySlug: string;
  storage: GitStorage;

  prVersions: Map<number, number>;

  username: string;
}

export interface BbsPr extends Pr {
  version?: number;
}

export enum BbsRestPrState {
  Declined = 'DECLINED',
  Open = 'OPEN',
  Merged = 'MERGED',
}

export interface BbsRestBranchRef {
  displayId: string;
  id: string;
}

export interface BbsRestUser {
  name: string;
}

export interface BbsRestUserRef {
  user: BbsRestUser;
}

export interface BbbsRestPr {
  createdDate: string;
  description: string;
  fromRef: BbsRestBranchRef;
  id: number;
  reviewers: BbsRestUserRef[];
  state: BbsRestPrState;
  title: string;
  toRef: BbsRestBranchRef;
  version?: number;
}
