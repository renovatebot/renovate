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

export const GitlabUser = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  commit_email: z.string().optional(),
});
export type GitlabUser = z.infer<typeof GitlabUser>;

export const GitlabUsers = z.array(GitlabUser);
export type GitlabUsers = z.infer<typeof GitlabUsers>;

export const GitLabMergeRequest = DeepNullish(
  z.object({
    iid: z.number(),
    title: z.string(),
    description: z.string().optional(),
    state: z.string(),
    source_branch: z.string(),
    target_branch: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    diverged_commits_count: z.number().optional(),
    merge_status: z.string().optional(),
    detailed_merge_status: z.string().optional(),
    merge_when_pipeline_succeeds: z.boolean().optional(),
    assignee: GitlabUser.optional(),
    assignees: LooseArray(GitlabUser).default([]),
    reviewers: LooseArray(GitlabUser).default([]),
    labels: z.array(z.string()).default([]),
    sha: LongCommitSha.optional(),
    pipeline: z
      .object({
        status: z.string(),
      })
      .optional(),
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

// See https://gitlab.com/gitlab-org/gitlab/-/blob/master/app/graphql/types/user_status_type.rb
export const GitlabUserStatus = z.object({
  message: z.string().optional(),
  message_html: z.string().optional(),
  emoji: z.string().optional(),
  availability: z.enum(['not_set', 'busy']),
});
export type GitlabUserStatus = z.infer<typeof GitlabUserStatus>;

export const MergeMethod = z.enum(['merge', 'rebase_merge', 'ff']);
export type MergeMethod = z.infer<typeof MergeMethod>;

export const RepoResponse = DeepNullish(
  z.object({
    id: z.number().optional(),
    archived: z.boolean().optional(),
    mirror: z.boolean().optional(),
    default_branch: z.string().optional(),
    empty_repo: z.boolean().optional(),
    ssh_url_to_repo: z.string().optional(),
    http_url_to_repo: z.string().optional(),
    forked_from_project: z.boolean().optional(),
    repository_access_level: z.string().optional(),
    merge_requests_access_level: z.string().optional(),
    merge_method: MergeMethod.catch('merge'),
    merge_trains_enabled: z.boolean().optional(),
    path_with_namespace: z.string().optional(),
    squash_option: z.string().optional(),
  }),
);
export type RepoResponse = z.infer<typeof RepoResponse>;

export const GitlabComment = z.object({
  body: z.string(),
  id: z.number(),
});
export type GitlabComment = z.infer<typeof GitlabComment>;

export const GitlabComments = z.array(GitlabComment);

export const GitlabIssue = z.object({
  iid: z.number(),
  labels: z.array(z.string()).optional(),
  title: z.string(),
  description: z.string().optional(),
});
export type GitlabIssue = z.infer<typeof GitlabIssue>;

export const GitlabIssues = z.array(GitlabIssue);

export const GitlabBranchStatus = z.object({
  status: z.string(),
  name: z.string(),
  allow_failure: z.boolean().optional(),
});
export type GitlabBranchStatus = z.infer<typeof GitlabBranchStatus>;

export const GitlabBranchStatuses = z.array(GitlabBranchStatus);

export const GitlabApprovalRule = z.object({
  name: z.string(),
  rule_type: z.string(),
  id: z.number(),
});
export type GitlabApprovalRule = z.infer<typeof GitlabApprovalRule>;

export const GitlabApprovalRules = z.array(GitlabApprovalRule);

export const GitlabVersion = z.object({
  version: z.string(),
});
export type GitlabVersion = z.infer<typeof GitlabVersion>;

export const GitlabRawFile = z.object({
  content: z.string(),
});
export type GitlabRawFile = z.infer<typeof GitlabRawFile>;

export const GitlabTreeNode = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  path: z.string(),
});
export type GitlabTreeNode = z.infer<typeof GitlabTreeNode>;

export const GitlabTree = z.array(GitlabTreeNode);
