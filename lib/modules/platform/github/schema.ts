import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';

export const IssueSchema = z.object({
  number: z.number(),
  state: z.string().transform((state) => state.toLowerCase()),
  title: z.string(),
  body: z.string(),
});

export const IssuesSchema = LooseArray(IssueSchema);
