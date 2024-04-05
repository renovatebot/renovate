import type { MergeStrategy } from '../../../config/types';
import type { BranchStatus } from '../../../types';
import { getPrBodyStruct } from '../pr-body';
import type { Pr } from '../types';
import type {
  BitbucketBranchState,
  BitbucketMergeStrategy,
  MergeRequestBody,
  PrResponse,
} from './types';

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

export const prFieldsFilter = [
  'values.id',
  'values.title',
  'values.state',
  'values.links.commits.href',
  'values.summary.raw',
  'values.source.branch.name',
  'values.destination.branch.name',
  'values.reviewers.display_name',
  'values.reviewers.uuid',
  'values.reviewers.nickname',
  'values.reviewers.account_status',
  'values.created_on',
  'values.updated_on',
].join(',');
