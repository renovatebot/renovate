import { z } from 'zod';

export const User = z.object({
  displayName: z.string(),
  emailAddress: z.string(),
  active: z.boolean(),
  slug: z.string(),
});

export const Users = z.array(User);

export const Files = z.array(z.string());

export const Comment = z.object({
  text: z.string(),
  id: z.number(),
});

export type Comment = z.infer<typeof Comment>;

export const PullRequestCommentActivity = z.object({
  action: z.literal('COMMENTED'),
  commentAction: z.string(),
  comment: Comment,
});

export type PullRequestCommentActivity = z.infer<
  typeof PullRequestCommentActivity
>;

export const PullRequestActivity = z.union([
  z.object({ action: z.string() }),
  PullRequestCommentActivity,
]);

export type PullRequestActivity = z.infer<typeof PullRequestActivity>;

const Email = z.string().email();

export const isEmail = (value: string): boolean =>
  Email.safeParse(value).success;
