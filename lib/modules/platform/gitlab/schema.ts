import { z } from 'zod';
import type { LongCommitSha } from '../../../util/git/types';

export const LastPipelineId = z
  .object({
    last_pipeline: z.object({
      id: z.number(),
    }),
  })
  .transform(({ last_pipeline }) => last_pipeline.id);

const GitlabUserSchema = z.object({
  id: z.number(),
  username: z.string(),
});

const LongCommitShaSchema = z.string().transform((val) => val as LongCommitSha);

export const GitLabMergeRequestSchema = z.object({
  iid: z.number(),
  title: z.string(),
  description: z.string(),
  state: z.string(),
  source_branch: z.string(),
  target_branch: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  diverged_commits_count: z.number().optional(),
  merge_status: z.string().optional(),
  assignee: GitlabUserSchema.optional(),
  assignees: z.array(GitlabUserSchema).optional(),
  reviewers: z.array(GitlabUserSchema).optional(),
  labels: z.array(z.string()).optional(),
  sha: LongCommitShaSchema.optional(),
  head_pipeline: z
    .object({
      status: z.string(),
      sha: LongCommitShaSchema,
    })
    .optional(),
});

export const GitLabMergeRequestsSchema = z.array(GitLabMergeRequestSchema);
export type GitLabMergeRequest = z.infer<typeof GitLabMergeRequestSchema>;
