import url from 'url';
import type { MergeStrategy } from '../../../config/types';
import type { BranchStatus } from '../../../types';
import { BitbucketHttp } from '../../../util/http/bitbucket';
import type { HttpOptions, HttpResponse } from '../../../util/http/types';
import { getPrBodyStruct } from '../pr-body';
import type { Pr } from '../types';
import type {
  BitbucketBranchState,
  BitbucketMergeStrategy,
  MergeRequestBody,
  PrResponse,
  RepoInfo,
  RepoInfoBody,
} from './types';

const bitbucketHttp = new BitbucketHttp();

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
  const { search, ...parsedUrl } = url.parse(inputUrl, true);
  const maxedUrl = url.format({
    ...parsedUrl,
    query: { ...parsedUrl.query, pagelen },
  });
  return maxedUrl;
};

function callApi<T>(
  apiUrl: string,
  method: string,
  options?: HttpOptions
): Promise<HttpResponse<T>> {
  /* istanbul ignore next */
  switch (method.toLowerCase()) {
    case 'post':
      return bitbucketHttp.postJson<T>(apiUrl, options);
    case 'put':
      return bitbucketHttp.putJson<T>(apiUrl, options);
    case 'patch':
      return bitbucketHttp.patchJson<T>(apiUrl, options);
    case 'head':
      return bitbucketHttp.headJson<T>(apiUrl, options);
    case 'delete':
      return bitbucketHttp.deleteJson<T>(apiUrl, options);
    case 'get':
    default:
      return bitbucketHttp.getJson<T>(apiUrl, options);
  }
}

export async function accumulateValues<T = any>(
  reqUrl: string,
  method = 'get',
  options?: HttpOptions,
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

export function prInfo(pr: PrResponse): Pr {
  return {
    number: pr.id,
    bodyStruct: getPrBodyStruct(pr.summary?.raw),
    sourceBranch: pr.source?.branch?.name,
    targetBranch: pr.destination?.branch?.name,
    title: pr.title,
    state: prStates.closed?.includes(pr.state)
      ? /* istanbul ignore next */ 'closed'
      : pr.state?.toLowerCase(),
    createdAt: pr.created_on,
  };
}
