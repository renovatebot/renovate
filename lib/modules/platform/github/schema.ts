import { z } from 'zod';

export const IssueSchema = z.object({
  number: z.number(),
  state: z.string().transform((state) => state.toLowerCase()),
  title: z.string(),
  body: z.string(),
});

export const IssuesSchema = z.array(IssueSchema);
