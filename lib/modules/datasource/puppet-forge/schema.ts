import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const PuppetReleaseAbbreviatedSchema = z.object({
  version: z.string(),
  created_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
  file_uri: z.string().optional().nullable(),
  file_size: z.number().optional().nullable(),
  uri: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
});

export const PuppetModuleSchema = z.object({
  releases: LooseArray(PuppetReleaseAbbreviatedSchema).default([]),
  homepage_url: z.string().optional().nullable(),
  deprecated_for: z.string().optional().nullable(),
});

export type PuppetModuleSchema = z.infer<typeof PuppetModuleSchema>;
