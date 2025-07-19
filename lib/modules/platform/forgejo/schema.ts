import { z } from 'zod';

export const ContentsResponseSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.union([z.literal('file'), z.literal('dir')]),
  content: z.string().nullable(),
});

export type ContentsResponse = z.infer<typeof ContentsResponseSchema>;

export const ContentsListResponseSchema = z.array(ContentsResponseSchema);
