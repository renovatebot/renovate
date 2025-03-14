import { z } from 'zod';

export const File = z.object({
  version: z.string(),
  createdAt: z.string().nullable(),
  yankedReason: z.string().nullable(),
  urls: z
    .array(z.object({ url: z.string(), kind: z.string() }))
    .optional()
    .default([])
    .transform((urls) => {
      return Object.fromEntries(urls.map((url) => [url.kind, url.url]));
    }),
});
