import type { HTTPError, Response } from 'got';
import type { Pr } from '../types';

export interface BbsConfig {
  bbUseDefaultReviewers: boolean;
  fileList: any[];
  mergeMethod: string;
  owner: string;
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

// https://docs.atlassian.com/bitbucket-server/rest/7.0.1/bitbucket-rest.html#idp280
export interface BbsRestPr {
  createdDate: string;
  updatedDate: number;
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
  slug: string;
  project: { key: string };
  origin?: { name: string; slug: string }; // only present in forks
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

export interface BbsPrCacheData {
  items: Record<number, BbsPr>;
  updatedDate: number | null;
  author: string | null;
}
