import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const PuppetReleaseAbbreviatedSchema = z.object({
  version: z.string(),
  created_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  file_uri: z.string().optional(),
  file_size: z.number().optional(),
  uri: z.string().optional(),
  slug: z.string().optional(),
});

export const PuppetModuleSchema = z.object({
  releases: LooseArray(PuppetReleaseAbbreviatedSchema).default([]),
  homepage_url: z.string().nullable().optional(),
  deprecated_for: z.string().nullable().optional(),
});

export type PuppetModuleSchema = z.infer<typeof PuppetModuleSchema>;
