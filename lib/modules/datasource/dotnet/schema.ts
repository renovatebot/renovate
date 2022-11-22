import { z } from 'zod';

const Product = z.union([z.literal('.NET Core'), z.literal('.NET')]);
const SupportPhase = z.union([
  z.literal('current'),
  z.literal('eol'),
  z.literal('lts'),
  z.literal('maintenance'),
  z.literal('preview'),
  z.literal('rc'),
]);
const ReleaseIndex = z.object({
  'channel-version': z.string(),
  'latest-release': z.string(),
  'latest-release-date': z.date(),
  security: z.boolean(),
  'latest-runtime': z.string(),
  'latest-sdk': z.string(),
  product: Product,
  'support-phase': SupportPhase,
  'eol-date': z.date().nullable(),
  'releases.json': z.string(),
});
export const DotnetReleasesIndexSchema = z.object({
  'releases-index': z.array(ReleaseIndex),
});

const ReleaseDetails = z.object({
  version: z.string(),
  'version-display': z.string(),
});
const ReleaseSchema = z.object({
  'release-date': z.date(),
  'release-version': z.string(),
  security: z.boolean(),
  'release-notes': z.string(),
  runtime: z.nullable(ReleaseDetails),
  sdk: z.nullable(ReleaseDetails),
});
export const DotnetReleasesSchema = z.object({
  'channel-version': z.string(),
  'latest-release': z.string(),
  'latest-release-date': z.date(),
  'latest-runtime': z.string(),
  'latest-sdk': z.string(),
  'support-phase': SupportPhase,
  releases: z.array(ReleaseSchema),
});

export type DotnetReleasesIndex = z.infer<typeof DotnetReleasesIndexSchema>;
export type DotnetReleases = z.infer<typeof DotnetReleasesSchema>;
export type DotnetRelease = z.infer<typeof ReleaseSchema>;
