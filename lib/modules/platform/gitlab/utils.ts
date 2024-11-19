import is from '@sindresorhus/is';
import { getPrBodyStruct } from '../pr-body';
import type { GitLabMergeRequest, GitlabPr } from './types';

export const DRAFT_PREFIX = 'Draft: ';
export const DRAFT_PREFIX_DEPRECATED = 'WIP: ';

export function prInfo(mr: GitLabMergeRequest): GitlabPr {
  const pr: GitlabPr = {
    sourceBranch: mr.source_branch,
    state: mr.state === 'opened' ? 'open' : mr.state,
    number: mr.iid,
    title: mr.title,
    ...(mr.target_branch && { targetBranch: mr.target_branch }),

    ...(mr.description && { bodyStruct: getPrBodyStruct(mr.description) }),

    ...(mr.head_pipeline?.status && {
      headPipelineStatus: mr.head_pipeline?.status,
    }),
    ...(mr.head_pipeline?.sha && { headPipelineSha: mr.head_pipeline?.sha }),
    ...((mr.assignee?.id ?? mr.assignees?.[0]?.id) && {
      hasAssignees: !!(mr.assignee?.id ?? mr.assignees?.[0]?.id),
    }),
    ...(is.nonEmptyArray(mr.reviewers) && {
      reviewers: mr.reviewers?.map(({ username }) => username),
    }),

    ...(mr.labels && { labels: mr.labels }),
    ...(mr.sha && { sha: mr.sha }),
    ...(mr.created_at && { createdAt: mr.created_at }),
    ...(mr.closed_at && { closedAt: mr.closed_at }),
  };

  if (pr.title.startsWith(DRAFT_PREFIX)) {
    pr.title = pr.title.substring(DRAFT_PREFIX.length);
    pr.isDraft = true;
  } else if (pr.title.startsWith(DRAFT_PREFIX_DEPRECATED)) {
    pr.title = pr.title.substring(DRAFT_PREFIX_DEPRECATED.length);
    pr.isDraft = true;
  }

  return pr;
}
