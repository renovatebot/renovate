import type { MergeStrategy } from '../../../config/types';
import type { BranchStatus } from '../../../types';
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

export function repoInfoTransformer(repoInfoBody: RepoInfoBody): RepoInfo {
  return {
    isFork: !!repoInfoBody.parent,
    owner: repoInfoBody.owner.username,
    mainbranch: repoInfoBody.mainbranch.name,
    mergeMethod: 'merge',
    has_issues: repoInfoBody.has_issues,
    uuid: repoInfoBody.uuid,
    is_private: repoInfoBody.is_private,
  };
}

const bitbucketMergeStrategies: Map<MergeStrategy, BitbucketMergeStrategy> =
  new Map([
    ['squash', 'squash'],
    ['merge-commit', 'merge_commit'],
    ['fast-forward', 'fast_forward'],
  ]);

export function mergeBodyTransformer(
  mergeStrategy: MergeStrategy | undefined,
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
