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

export type File = z.infer<typeof File>;

export const PagedResponse = z.object({
  data: z.object({
    package: z
      .object({
        variants: z
          .object({
            pages: z.number(),
            page: z.array(File),
          })
          .nullable(),
      })
      .nullable(),
  }),
});
