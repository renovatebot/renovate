import { z } from 'zod';
import { logger } from '../../../logger';
import { LooseArray } from '../../../util/schema-utils';

const Package = z.object({
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

const SecurityVulnerability = z
  .object({
    first_patched_version: z.object({ identifier: z.string() }).nullish(),
    package: Package,
    vulnerable_version_range: z.string(),
  })
  .nullable();

const SecurityAdvisory = z.object({
  description: z.string(),
  identifiers: z.array(
    z.object({
      type: z.string(),
      value: z.string(),
    }),
  ),
  references: z.array(z.object({ url: z.string() })).optional(),
});

export const GithubVulnerabilityAlert = LooseArray(
  z.object({
    dismissed_reason: z.string().nullish(),
    security_advisory: SecurityAdvisory,
    security_vulnerability: SecurityVulnerability,
    dependency: z.object({
      manifest_path: z.string(),
    }),
  }),
  {
    /* v8 ignore start */
    onError: ({ error }) => {
      logger.debug(
        { error },
        'Vulnerability Alert: Failed to parse some alerts',
      );
    },
    /* v8 ignore stop */
  },
);
export type GithubVulnerabilityAlert = z.infer<typeof GithubVulnerabilityAlert>;

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

export const GithubBranchProtection = z.object({
  required_status_checks: z
    .object({
      strict: z.boolean(),
    })
    .nullish()
    .optional(),
});
export type GithubBranchProtection = z.infer<typeof GithubBranchProtection>;

const GithubRulesetRule = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('non_fast_forward'),
  }),
  z.object({
    type: z.literal('required_status_checks'),
    parameters: z.object({
      strict_required_status_checks_policy: z.boolean().optional(),
    }),
  }),
  // prevents deletion
  z.object({
    type: z.literal('deletion'),
  }),
]);

export const GithubBranchRulesets = LooseArray(GithubRulesetRule);
export type GithubBranchRulesets = z.infer<typeof GithubBranchRulesets>;
