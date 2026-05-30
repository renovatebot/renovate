import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const JenkinsPluginInfoSchema = z.object({
  name: z.string(),
  scm: z.string().optional(),
});

export const JenkinsPluginsInfoResponseSchema = z.object({
  plugins: z.record(z.string(), JenkinsPluginInfoSchema).default({}),
});
export type JenkinsPluginsInfoResponse = z.infer<
  typeof JenkinsPluginsInfoResponseSchema
>;

export const JenkinsPluginVersionSchema = z.object({
  version: z.string(),
  buildDate: z.string().optional(),
  url: z.string().optional(),
  requiredCore: z.string().optional(),
  releaseTimestamp: MaybeTimestamp.optional(),
});
export type JenkinsPluginVersion = z.infer<typeof JenkinsPluginVersionSchema>;

export const JenkinsPluginsVersionsResponseSchema = z.object({
  plugins: z
    .record(z.string(), z.record(z.string(), JenkinsPluginVersionSchema))
    .default({}),
});
export type JenkinsPluginsVersionsResponse = z.infer<
  typeof JenkinsPluginsVersionsResponseSchema
>;
