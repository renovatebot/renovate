import { z } from 'zod';

export const Pr = z.object(
  {
    sourceBranch: z.string().min(1),
    number: z.number(),
    state: z.string().min(1),
    title: z.string().min(1),
  },
  {
    description: 'Pull Request',
  }
);
