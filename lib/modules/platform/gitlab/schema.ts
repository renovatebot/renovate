import { z } from 'zod';
import type { LongCommitSha } from '../../../util/git/types';
import { LooseArray } from '../../../util/schema-utils';

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
  description: z.string().nullable(),
  state: z.string(),
  source_branch: z.string(),
  target_branch: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  diverged_commits_count: z.number().optional(),
  merge_status: z.string().optional(),
  assignee: GitlabUserSchema.nullish(),
  assignees: LooseArray(GitlabUserSchema).catch([]),
  reviewers: LooseArray(GitlabUserSchema).catch([]),
  labels: z.array(z.string()).optional(),
  sha: LongCommitShaSchema.nullish(),
  head_pipeline: z
    .object({
      status: z.string(),
      sha: LongCommitShaSchema,
    })
    .nullish(),
});

export const GitLabMergeRequestsSchema = z.array(GitLabMergeRequestSchema);
export type GitLabMergeRequest = z.infer<typeof GitLabMergeRequestSchema>;
