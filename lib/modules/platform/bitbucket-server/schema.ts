import { z } from 'zod/v3';
import { EmailAddress } from '../../../util/schema-utils/index.ts';

export const User = z.object({
  name: z.string(),
  displayName: z.string(),
  emailAddress: EmailAddress.catch(''),
  active: z.boolean(),
});

export const Users = z.array(User);

export const Files = z.array(z.string());

export const Comment = z.object({
  text: z.string(),
  id: z.number(),
});

export type Comment = z.infer<typeof Comment>;

export const PullRequestMerge = z.object({
  autoMerge: z.boolean().optional(),
});

export type PullRequestMerge = z.infer<typeof PullRequestMerge>;

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

export const ReviewerGroup = z.object({
  name: z.string(),
  users: z.array(User),
  scope: z.object({
    type: z.union([z.literal('REPOSITORY'), z.literal('PROJECT')]),
  }),
});
export const ReviewerGroups = z.array(ReviewerGroup);
