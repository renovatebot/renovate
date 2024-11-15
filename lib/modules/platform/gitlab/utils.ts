import { getPrBodyStruct } from '../pr-body';
import type { GitLabMergeRequest, GitlabPr } from './types';

export function prInfo(mr: GitLabMergeRequest): GitlabPr {
  return {
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
    number: mr.iid,
    bodyStruct: getPrBodyStruct(mr.description),
    state: mr.state === 'opened' ? 'open' : mr.state,
    headPipelineStatus: mr.head_pipeline?.status,
    headPipelineSha: mr.head_pipeline?.sha,
    hasAssignees: !!(mr.assignee?.id ?? mr.assignees?.[0]?.id),
    reviewers: mr.reviewers?.map(({ username }) => username),
    title: mr.title,
    labels: mr.labels,
    sha: mr.sha,
  };
}
