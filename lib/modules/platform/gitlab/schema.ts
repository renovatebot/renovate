import { z } from 'zod/v4';
import { LongCommitSha } from '../../../util/schema-utils/git.ts';
import { DeepNullish, LooseArray } from '../../../util/schema-utils/index.ts';

export const LastPipelineId = z
  .object({
    last_pipeline: z.object({
      id: z.number(),
    }),
  })
  .transform(({ last_pipeline }) => last_pipeline.id);

const GitlabUser = z.object({
  id: z.number(),
  username: z.string(),
});

export const GitLabMergeRequest = DeepNullish(
  z.object({
    iid: z.number(),
    title: z.string(),
    description: z.string().nullable(),
    state: z.string(),
    source_branch: z.string(),
    target_branch: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    diverged_commits_count: z.number().optional(),
    merge_status: z.string().optional(),
    detailed_merge_status: z
      .enum([
        'approvals_syncing',
        'checking',
        'ci_must_pass',
        'ci_still_running',
        'commits_status',
        'conflict',
        'discussions_not_resolved',
        'draft_status',
        'jira_association_missing',
        'mergeable',
        'merge_request_blocked',
        'merge_time',
        'need_rebase',
        'not_approved',
        'not_open',
        'preparing',
        'requested_changes',
        'security_policy_pipeline_check',
        'security_policy_violations',
        'status_checks_must_pass',
        'unchecked',
        'locked_paths',
        'locked_lfs_files',
        'title_regex',
        'unknown',
      ])
      .catch('unknown'),
    assignee: GitlabUser.optional(),
    assignees: LooseArray(GitlabUser).catch([]),
    reviewers: LooseArray(GitlabUser).catch([]),
    labels: z.array(z.string()).optional(),
    sha: LongCommitSha.optional(),
    head_pipeline: z
      .object({
        status: z.string(),
        sha: LongCommitSha,
      })
      .optional(),
  }),
);

export const GitLabMergeRequests = z.array(GitLabMergeRequest);
export type GitLabMergeRequest = z.infer<typeof GitLabMergeRequest>;
