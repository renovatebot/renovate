import type { HTTPError, Response } from 'got';
import type { Pr } from '../types';

export interface BbsConfig {
  bbUseDefaultReviewers: boolean;
  fileList: any[];
  mergeMethod: string;
  owner: string;
  prList: BbsPr[];
  projectKey: string;
  repository: string;
  repositorySlug: string;

  prVersions: Map<number, number>;
  ignorePrAuthor: boolean;
  username: string;
}

export interface BbsPr extends Pr {
  version?: number;
}

export type BbsRestPrState = 'DECLINED' | 'OPEN' | 'MERGED';

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

export interface BbsRestPr {
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

export interface BbsRestRepo {
  id: number;
  project: { key: string };
  origin: { name: string; slug: string };
  links: {
    clone?: { href: string; name: string }[];
  };
}

export interface BbsRestBranch {
  displayId: string;
}

export interface BitbucketErrorResponse {
  errors?: {
    exceptionName?: string;
    reviewerErrors?: { context?: string }[];
  }[];
}

export interface BitbucketError extends HTTPError {
  readonly response: Response<BitbucketErrorResponse>;
}
