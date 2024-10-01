import { z } from 'zod';
import { logger } from '../../../logger';
import { LooseArray } from '../../../util/schema-utils';

const PackageSchema = z.object({
  ecosystem: z.union([
    z.literal('maven'),
    z.literal('npm'),
    z.literal('nuget'),
    z.literal('pip'),
    z.literal('rubygems'),
    z.literal('rust'),
    z.literal('composer'),
    z.literal('go'),
  ]),
  name: z.string(),
});

const SecurityVulnerabilitySchema = z
  .object({
    first_patched_version: z.object({ identifier: z.string() }).nullish(),
    package: PackageSchema,
    vulnerable_version_range: z.string(),
  })
  .nullable();

const SecurityAdvisorySchema = z.object({
  description: z.string(),
  identifiers: z.array(
    z.object({
      type: z.string(),
      value: z.string(),
    }),
  ),
  references: z.array(z.object({ url: z.string() })).optional(),
});

export const VulnerabilityAlertSchema = LooseArray(
  z.object({
    dismissed_reason: z.string().nullish(),
    security_advisory: SecurityAdvisorySchema,
    security_vulnerability: SecurityVulnerabilitySchema,
    dependency: z.object({
      manifest_path: z.string(),
    }),
  }),
  {
    onError: /* istanbul ignore next */ ({ error }) => {
      logger.debug(
        { error },
        'Vulnerability Alert: Failed to parse some alerts',
      );
    },
  },
);

// https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#get-repository-content
const GithubResponseMetadata = z.object({
  name: z.string(),
  path: z.string(),
});

export const GithubFileMeta = GithubResponseMetadata.extend({
  type: z.literal('file'),
});
export type GithubFileMeta = z.infer<typeof GithubFileMeta>;

export const GithubFile = GithubFileMeta.extend({
  content: z.string(),
  encoding: z.string(),
});
export type GithubFile = z.infer<typeof GithubFile>;

export const GithubDirectory = GithubResponseMetadata.extend({
  type: z.literal('dir'),
});

export type GithubDirectory = z.infer<typeof GithubDirectory>;

export const GithubOtherContent = GithubResponseMetadata.extend({
  type: z.literal('symlink').or(z.literal('submodule')),
});

export type GithubOtherContent = z.infer<typeof GithubOtherContent>;

export const GithubElement = GithubFile.or(GithubFileMeta)
  .or(GithubDirectory)
  .or(GithubOtherContent);
export type GithubElement = z.infer<typeof GithubElement>;

export const GithubContentResponse = z.array(GithubElement).or(GithubElement);
