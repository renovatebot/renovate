import url from 'url';
import { BranchStatus, PrState } from '../../types';
import { HttpOptions, HttpPostOptions, HttpResponse } from '../../util/http';
import { BitbucketHttp } from '../../util/http/bitbucket';
import type { Pr } from '../types';

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
}

export function repoInfoTransformer(repoInfoBody: RepoInfoBody): RepoInfo {
  return {
    isFork: !!repoInfoBody.parent,
    owner: repoInfoBody.owner.username,
    mainbranch: repoInfoBody.mainbranch.name,
    mergeMethod: 'merge',
    has_issues: repoInfoBody.has_issues,
  };
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

interface Files {
  chunks: {
    changes: {
      content: string;
    }[];
  }[];
}

export function isConflicted(files: Files[]): boolean {
  for (const file of files) {
    for (const chunk of file.chunks) {
      for (const change of chunk.changes) {
        if (change.content === '+=======') {
          return true;
        }
      }
    }
  }
  return false;
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
  reviewers: Array<any>;
  created_on: string;
}

export function prInfo(pr: PrResponse): Pr {
  return {
    number: pr.id,
    displayNumber: `Pull Request #${pr.id}`,
    body: pr.summary?.raw,
    sourceBranch: pr.source?.branch?.name,
    targetBranch: pr.destination?.branch?.name,
    title: pr.title,
    state: prStates.closed?.includes(pr.state)
      ? /* istanbul ignore next */ PrState.Closed
      : pr.state?.toLowerCase(),
    createdAt: pr.created_on,
  };
}
