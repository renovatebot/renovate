import { z } from 'zod';

const UrlSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);

export const MonorepoSchema = z.object({
  repoGroups: UrlSchema,
  orgGroups: UrlSchema,
  patternGroups: UrlSchema,
});

const PackageRuleSchema = z.object({
  matchCurrentVersion: z.string().optional(),
  matchDatasources: z.array(z.string()),
  matchPackageNames: z.array(z.string()),
  replacementName: z.string().optional(),
  replacementVersion: z.string().optional(),
  description: z.string().optional(),
  replacementNameTemplate: z.string().optional(),
  replacementVersionTemplate: z.string().optional(),
});

const RuleSetSchema = z.object({
  description: z.string(),
  packageRules: z
    .array(PackageRuleSchema)
    .min(1)
    .refine(
      (rules) =>
        rules.some(
          (rule) =>
            rule.replacementName !== undefined ||
            rule.replacementNameTemplate !== undefined,
        ),
      {
        message:
          'At least one package rule must use either the replacementName config option, or the replacementNameTemplate config option',
      },
    ),
});

const AllSchema = z.object({
  description: z.string(),
  extends: z.array(z.string()),
  ignoreDeps: z.array(z.string()).optional(),
});

export const ReplacementsSchema = z
  .object({
    $schema: z.string(),
    all: AllSchema,
  })
  .catchall(RuleSetSchema);

export const ChangelogUrlsSchema = z
  .object({
    $schema: z.string(),
  })
  .catchall(z.record(z.string(), z.string().url()));

export const SourceUrlsSchema = z
  .object({
    $schema: z.string(),
  })
  .catchall(z.record(z.string(), z.string().url()));

export const AbandonmentsSchema = z
  .object({
    $schema: z.string(),
  })
  .catchall(z.record(z.string(), z.string()));
