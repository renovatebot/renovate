import url from 'url';
import type { MergeStrategy } from '../../../config/types';
import { BranchStatus, PrState } from '../../../types';
import { BitbucketHttp } from '../../../util/http/bitbucket';
import type {
  HttpOptions,
  HttpPostOptions,
  HttpResponse,
} from '../../../util/http/types';
import { getPrBodyStruct } from '../pr-body';
import type { Pr } from '../types';
import type { BitbucketMergeStrategy, MergeRequestBody } from './types';

const bitbucketHttp = new BitbucketHttp();

export interface Config {
  defaultBranch: string;
  has_issues: boolean;
  mergeMethod: string;
  owner: string;
  prList: Pr[];
  repository: string;
  username: string;
  userUuid: string;
  ignorePrAuthor: boolean;
}

export interface PagedResult<T = any> {
  pagelen: number;
  size?: number;
  next?: string;
  values: T[];
}

export interface RepoInfo {
  isFork: boolean;
  owner: string;
  mainbranch: string;
  mergeMethod: string;
  has_issues: boolean;
  uuid: string;
}

export type BitbucketBranchState = 'SUCCESSFUL' | 'FAILED' | 'INPROGRESS';
export interface BitbucketStatus {
  key: string;
  state: BitbucketBranchState;
}

export interface RepoInfoBody {
  parent?: any;
  owner: { username: string };
  mainbranch: { name: string };
  has_issues: boolean;
  uuid: string;
}

export function repoInfoTransformer(repoInfoBody: RepoInfoBody): RepoInfo {
  return {
    isFork: !!repoInfoBody.parent,
    owner: repoInfoBody.owner.username,
    mainbranch: repoInfoBody.mainbranch.name,
    mergeMethod: 'merge',
    has_issues: repoInfoBody.has_issues,
    uuid: repoInfoBody.uuid,
  };
}

const bitbucketMergeStrategies: Map<MergeStrategy, BitbucketMergeStrategy> =
  new Map([
    ['squash', 'squash'],
    ['merge-commit', 'merge_commit'],
    ['fast-forward', 'fast_forward'],
  ]);

export function mergeBodyTransformer(
  mergeStrategy: MergeStrategy | undefined
): MergeRequestBody {
  const body: MergeRequestBody = {
    close_source_branch: true,
  };

  // The `auto` strategy will use the strategy configured inside Bitbucket.
  if (mergeStrategy && mergeStrategy !== 'auto') {
    body.merge_strategy = bitbucketMergeStrategies.get(mergeStrategy);
  }

  return body;
}

export const prStates = {
  open: ['OPEN'],
  notOpen: ['MERGED', 'DECLINED', 'SUPERSEDED'],
  merged: ['MERGED'],
  closed: ['DECLINED', 'SUPERSEDED'],
  all: ['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED'],
};

export const buildStates: Record<BranchStatus, BitbucketBranchState> = {
  green: 'SUCCESSFUL',
  red: 'FAILED',
  yellow: 'INPROGRESS',
};

const addMaxLength = (inputUrl: string, pagelen = 100): string => {
  const { search, ...parsedUrl } = url.parse(inputUrl, true); // eslint-disable-line @typescript-eslint/no-unused-vars
  const maxedUrl = url.format({
    ...parsedUrl,
    query: { ...parsedUrl.query, pagelen },
  });
  return maxedUrl;
};

function callApi<T>(
  apiUrl: string,
  method: string,
  options?: HttpOptions | HttpPostOptions
): Promise<HttpResponse<T>> {
  /* istanbul ignore next */
  switch (method.toLowerCase()) {
    case 'post':
      return bitbucketHttp.postJson<T>(apiUrl, options as HttpPostOptions);
    case 'put':
      return bitbucketHttp.putJson<T>(apiUrl, options as HttpPostOptions);
    case 'patch':
      return bitbucketHttp.patchJson<T>(apiUrl, options as HttpPostOptions);
    case 'head':
      return bitbucketHttp.headJson<T>(apiUrl, options);
    case 'delete':
      return bitbucketHttp.deleteJson<T>(apiUrl, options as HttpPostOptions);
    case 'get':
    default:
      return bitbucketHttp.getJson<T>(apiUrl, options);
  }
}

export async function accumulateValues<T = any>(
  reqUrl: string,
  method = 'get',
  options?: HttpOptions | HttpPostOptions,
  pagelen?: number
): Promise<T[]> {
  let accumulator: T[] = [];
  let nextUrl = addMaxLength(reqUrl, pagelen);

  while (typeof nextUrl !== 'undefined') {
    const { body } = await callApi<{ values: T[]; next: string }>(
      nextUrl,
      method,
      options
    );
    accumulator = [...accumulator, ...body.values];
    nextUrl = body.next;
  }

  return accumulator;
}

export interface PrResponse {
  id: number;
  title: string;
  state: string;
  links: {
    commits: {
      href: string;
    };
  };
  summary?: { raw: string };
  source: {
    branch: {
      name: string;
    };
  };
  destination: {
    branch: {
      name: string;
    };
  };
  reviewers: Array<Account>;
  created_on: string;
}

export function prInfo(pr: PrResponse): Pr {
  return {
    number: pr.id,
    displayNumber: `Pull Request #${pr.id}`,
    bodyStruct: getPrBodyStruct(pr.summary?.raw),
    sourceBranch: pr.source?.branch?.name,
    targetBranch: pr.destination?.branch?.name,
    title: pr.title,
    state: prStates.closed?.includes(pr.state)
      ? /* istanbul ignore next */ PrState.Closed
      : pr.state?.toLowerCase(),
    createdAt: pr.created_on,
  };
}

export interface Account {
  display_name?: string;
  uuid: string;
  nickname?: string;
  account_status?: string;
}
