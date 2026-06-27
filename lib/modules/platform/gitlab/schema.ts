import { z } from 'zod/v4';
import { LongCommitSha } from '../../../util/schema-utils/git.ts';
import { LooseArray } from '../../../util/schema-utils/index.ts';

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

export const GitLabMergeRequest = z.object({
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
  assignee: GitlabUser.nullish(),
  assignees: LooseArray(GitlabUser).catch([]),
  reviewers: LooseArray(GitlabUser).catch([]),
  labels: z.array(z.string()).optional(),
  sha: LongCommitSha.nullish(),
  head_pipeline: z
    .object({
      status: z.string(),
      sha: LongCommitSha,
    })
    .nullish(),
});

export const GitLabMergeRequests = z.array(GitLabMergeRequest);
export type GitLabMergeRequest = z.infer<typeof GitLabMergeRequest>;
