import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const JenkinsPluginInfo = z.object({
  name: z.string(),
  scm: z.string().optional(),
});

export const JenkinsPluginsInfoResponse = z.object({
  plugins: z.record(z.string(), JenkinsPluginInfo).default({}),
});
export type JenkinsPluginsInfoResponse = z.infer<
  typeof JenkinsPluginsInfoResponse
>;

export const JenkinsPluginVersion = z.object({
  version: z.string(),
  buildDate: z.string().optional(),
  url: z.string().optional(),
  requiredCore: z.string().optional(),
  releaseTimestamp: MaybeTimestamp.optional(),
});
export type JenkinsPluginVersion = z.infer<typeof JenkinsPluginVersion>;

export const JenkinsPluginsVersionsResponse = z.object({
  plugins: z
    .record(z.string(), z.record(z.string(), JenkinsPluginVersion))
    .default({}),
});
export type JenkinsPluginsVersionsResponse = z.infer<
  typeof JenkinsPluginsVersionsResponse
>;
