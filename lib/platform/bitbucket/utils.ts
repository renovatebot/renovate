import url from 'url';
import { api } from './bb-got-wrapper';
import { Storage } from '../git/storage';
import { GotResponse } from '../common';

export interface Config {
  baseBranch: string;
  baseCommitSHA: string;
  defaultBranch: string;
  fileList: any[];
  has_issues: boolean;
  mergeMethod: string;
  owner: string;
  prList: any[];
  repository: string;
  storage: Storage;

  username: string;
}

export interface PagedResult<T = any> {
  size: number;
  next?: string;
  values: T[];
}

export function repoInfoTransformer(repoInfoBody: any) {
  return {
    privateRepo: repoInfoBody.is_private,
    isFork: !!repoInfoBody.parent,
    repoFullName: repoInfoBody.full_name,
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

export const buildStates: {
  [key: string]: string;
  success: string;
  failed: string;
  pending: string;
} = {
  success: 'SUCCESSFUL',
  failed: 'FAILED',
  pending: 'INPROGRESS',
};

const addMaxLength = (inputUrl: string, pagelen = 100) => {
  const { search, ...parsedUrl } = url.parse(inputUrl, true); // eslint-disable-line @typescript-eslint/no-unused-vars
  const maxedUrl = url.format({
    ...parsedUrl,
    query: { ...parsedUrl.query, pagelen },
  });
  return maxedUrl;
};

export async function accumulateValues<T = any>(
  reqUrl: string,
  method = 'get',
  options?: any,
  pagelen?: number
) {
  let accumulator: T[] = [];
  let nextUrl = addMaxLength(reqUrl, pagelen);
  const lowerCaseMethod = method.toLocaleLowerCase();

  while (typeof nextUrl !== 'undefined') {
    const { body } = (await api[lowerCaseMethod](
      nextUrl,
      options
    )) as GotResponse<PagedResult<T>>;
    accumulator = [...accumulator, ...body.values];
    nextUrl = body.next;
  }

  return accumulator;
}

export /* istanbul ignore next */ function isConflicted(files: any) {
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

export function prInfo(pr: any) {
  return {
    number: pr.id,
    body: pr.summary ? pr.summary.raw : /* istanbul ignore next */ undefined,
    branchName: pr.source.branch.name,
    title: pr.title,
    state: prStates.closed.includes(pr.state)
      ? /* istanbul ignore next */ 'closed'
      : pr.state.toLowerCase(),
    createdAt: pr.created_on,
  };
}
