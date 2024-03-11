import { z } from 'zod';
import type { GithubIssue as Issue } from './types';

const GithubIssueBase = z.object({
  number: z.number(),
  state: z.string().transform((val) => val.toLowerCase()),
  title: z.string(),
  body: z.string(),
});

const GithubGraphqlIssue = GithubIssueBase.extend({
  updatedAt: z.string(),
}).transform((issue): Issue => {
  const lastModified = issue.updatedAt;
  const { number, state, title, body } = issue;
  return { number, state, title, body, lastModified };
});

const GithubRestIssue = GithubIssueBase.extend({
  updated_at: z.string(),
}).transform((issue): Issue => {
  const lastModified = issue.updated_at;
  const { number, state, title, body } = issue;
  return { number, state, title, body, lastModified };
});

export const GithubIssue = z.union([GithubGraphqlIssue, GithubRestIssue]);
export type GithubIssue = z.infer<typeof GithubIssue>;
