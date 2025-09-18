import { z } from 'zod';

const Url = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

export const Monorepo = z.object({
  repoGroups: Url,
  orgGroups: Url,
  patternGroups: Url,
});

const PackageRule = z.object({
  matchCurrentVersion: z.string().optional(),
  matchDatasources: z.array(z.string()),
  matchPackageNames: z.array(z.string()),
  replacementName: z.string().optional(),
  replacementVersion: z.string().optional(),
  description: z.string().optional(),
  replacementNameTemplate: z.string().optional(),
  replacementVersionTemplate: z.string().optional(),
});

const RuleSet = z.object({
  description: z.string(),
  packageRules: z
    .array(PackageRule)
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

const All = z.object({
  description: z.string(),
  extends: z.array(z.string()),
  ignoreDeps: z.array(z.string()).optional(),
});

export const Replacements = z
  .object({
    $schema: z.string(),
    all: All,
  })
  .catchall(RuleSet);

export const ChangelogUrls = z
  .object({
    $schema: z.string(),
  })
  .catchall(z.record(z.string(), z.string().url()));

export const SourceUrls = z
  .object({
    $schema: z.string(),
  })
  .catchall(z.record(z.string(), z.string().url()));

export const Abandonments = z
  .object({
    $schema: z.string(),
  })
  .catchall(z.record(z.string(), z.string()));
