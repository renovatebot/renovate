import { z } from 'zod';

export const UserSchema = z.object({
  displayName: z.string(),
  emailAddress: z.string(),
});

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
