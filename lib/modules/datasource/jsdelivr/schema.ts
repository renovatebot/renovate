import { z } from 'zod/v4';
import type { Release } from '../types.ts';

export const JsDelivrPackageVersion = z
  .array(
    z.object({
      version: z.string(),
    }),
  )
  .transform((versions): Release[] =>
    versions.map(({ version }) => ({ version })),
  );

export const JsDelivrPackageResponse = z.object({
  tags: z
    .object({
      latest: z.string().optional(),
      beta: z.string().optional(),
    })
    .optional(),
  versions: JsDelivrPackageVersion,
});

export const JsDelivrFile = z.object({
  name: z.string(),
  hash: z.string().optional().catch(undefined),
});

export const JsDelivrDigestResponse = z.object({
  files: z.array(JsDelivrFile),
});
