import { z } from 'zod';
import type { LongCommitSha } from '../../../util/git/types';

export const ContentsResponseSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.union([z.literal('file'), z.literal('dir')]),
  content: z.string().nullable(),
});

export type ContentsResponse = z.infer<typeof ContentsResponseSchema>;

export const ContentsListResponseSchema = z.array(ContentsResponseSchema);

export const RepoPermission = z.object({
  admin: z.boolean(),
  pull: z.boolean(),
  push: z.boolean(),
});

export const Repo = z.object({
  id: z.number(),
  owner: z.object({
    login: z.string(),
  }),
  name: z.string(),
  full_name: z.string(),
  default_branch: z.string(),
  private: z.boolean(),
  fork: z.boolean(),
  archived: z.boolean(),
  disabled: z.boolean(),
  size: z.number(),
  stargazers_count: z.number(),
  watchers_count: z.number(),
  permissions: RepoPermission.optional(),
});
export type Repo = z.infer<typeof Repo>;

export const GiteaLabel = z.object({
  id: z.number(),
  name: z.string(),
});
export type GiteaLabel = z.infer<typeof GiteaLabel>;

const PrState = z.enum(['open', 'closed', 'merged']);
export type PrState = z.infer<typeof PrState>;

export const Pr = z.object({
  number: z.number(),
  state: PrState,
  title: z.string(),
  body: z.string(),
  mergeable: z.boolean(),
  merged: z.boolean().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string(),
  diff_url: z.string(),
  base: z
    .object({
      ref: z.string(),
    })
    .nullish(),
  head: z
    .object({
      label: z.string(),
      sha: z.string().transform((v) => v as LongCommitSha),
      repo: Repo.nullish(),
    })
    .nullish(),
  assignee: z
    .object({
      login: z.string().nullish(),
    })
    .nullish(),
  assignees: z.array(z.unknown()).nullish(),
  user: z.object({ username: z.string().nullish() }).nullish(),
  /**
   * labels returned from the Gitea API are represented as an array of objects
   * ref: https://docs.gitea.com/api/1.20/#tag/repository/operation/repoGetPullRequest
   */
  labels: z.array(GiteaLabel).nullish(),
});
export type Pr = z.infer<typeof Pr>;

export const User = z.object({
  id: z.number(),
  email: z.string(),
  full_name: z.string().nullish(),
  username: z.string(),
});
export type User = z.infer<typeof User>;
