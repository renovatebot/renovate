import { z } from 'zod';

export const LastPipelineId = z
  .object({
    last_pipeline: z.object({
      id: z.number(),
    }),
  })
  .transform(({ last_pipeline }) => last_pipeline.id);

export const GitLabApprovalRules = z.array(
  z.object({
    name: z.string(),
    eligible_approvers: z
      .array(
        z.object({
          id: z.number(),
        }),
      )
      .optional(),
  }),
);
