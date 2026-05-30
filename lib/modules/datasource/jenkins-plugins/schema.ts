import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const JenkinsPluginInfoSchema = z.object({
  name: z.string(),
  scm: z.string().optional(),
});

export const JenkinsPluginsInfoResponseSchema = z.object({
  plugins: z.record(z.string(), JenkinsPluginInfoSchema).default({}),
});

export const JenkinsPluginVersionSchema = z.object({
  version: z.string(),
  buildDate: z.string().optional(),
  url: z.string().optional(),
  requiredCore: z.string().optional(),
  releaseTimestamp: MaybeTimestamp,
});

export const JenkinsPluginsVersionsResponseSchema = z.object({
  plugins: z
    .record(z.string(), z.record(z.string(), JenkinsPluginVersionSchema))
    .default({}),
});
