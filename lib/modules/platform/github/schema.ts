import { z } from 'zod';

export const Milestone = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  description: z.string(),
  state: z.string(),
});
export type Milestone = z.infer<typeof Milestone>;
