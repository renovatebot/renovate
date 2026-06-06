import { z } from 'zod/v4';

export const ContentsResponse = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'dir', 'symlink', 'submodule']),
  content: z.string().nullable(),
});

export type ContentsResponse = z.infer<typeof ContentsResponse>;

export const ContentsListResponse = z.array(ContentsResponse);
