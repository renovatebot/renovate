import { z } from 'zod';
import { regEx } from '../../../util/regex';
import { LooseArray } from '../../../util/schema-utils';

export const VendirResource = z.object({
  apiVersion: z.literal('vendir.k14s.io/v1alpha1'),
  kind: z.literal('Config'),
});

export const GitRef = z.object({
  ref: z.string(),
  url: z.string().regex(regEx(/^(?:ssh|https?):\/\/.+/)),
  depth: z.number().optional(),
});

export const GithubRelease = z.object({
  slug: z.string(),
  tag: z.string(),
});

export const HelmChart = z.object({
  name: z.string(),
  version: z.string(),
  repository: z.object({
    url: z.string().regex(regEx(/^(?:oci|https?):\/\/.+/)),
  }),
});

export const HelmChartContent = z.object({
  path: z.string(),
  helmChart: HelmChart,
});

export const GitRefContent = z.object({
  path: z.string(),
  git: GitRef,
});

export const GithubReleaseContent = z.object({
  path: z.string(),
  githubRelease: GithubRelease,
});

export const Contents = z.union([
  HelmChartContent,
  GitRefContent,
  GithubReleaseContent,
]);

export const Vendir = VendirResource.extend({
  directories: z.array(
    z.object({
      path: z.string(),
      contents: LooseArray(Contents),
    }),
  ),
});

// Lockfile schemas
export const VendirLockResource = z.object({
  apiVersion: z.literal('vendir.k14s.io/v1alpha1'),
  kind: z.literal('LockConfig'),
});

export const LockedHelmChart = z.object({
  version: z.string(),
  appVersion: z.string().optional(),
});

export const LockedGitRef = z.object({
  sha: z.string(),
  tags: z.array(z.string()).optional(),
});

export const LockedGithubRelease = z.object({
  url: z.string(),
  tag: z.string().optional(),
});

export const LockedHelmChartContent = z.object({
  path: z.string(),
  helmChart: LockedHelmChart,
});

export const LockedGitRefContent = z.object({
  path: z.string(),
  git: LockedGitRef,
});

export const LockedGithubReleaseContent = z.object({
  path: z.string(),
  githubRelease: LockedGithubRelease,
});

export const LockedContents = z.union([
  LockedHelmChartContent,
  LockedGitRefContent,
  LockedGithubReleaseContent,
]);

export const VendirLock = VendirLockResource.extend({
  directories: z.array(
    z.object({
      path: z.string(),
      contents: LooseArray(LockedContents),
    }),
  ),
});

export type VendirDefinition = z.infer<typeof Vendir>;
export type HelmChartDefinition = z.infer<typeof HelmChart>;
export type GitRefDefinition = z.infer<typeof GitRef>;
export type GithubReleaseDefinition = z.infer<typeof GithubRelease>;
export type VendirLockDefinition = z.infer<typeof VendirLock>;
