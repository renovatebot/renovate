import { z } from 'zod';

const ComposerLockPackage = z.object({
  name: z.string(),
  version: z.string(),
});

export const ComposerLock = z.object({
  'plugin-api-version': z.string().optional(),
  packages: z.array(ComposerLockPackage).optional(),
  'packages-dev': z.array(ComposerLockPackage).optional(),
});
export type ComposerLock = z.infer<typeof ComposerLock>;

const ComposerRepository = z.object({
  name: z.string().optional(),
  type: z.union([
    z.literal('composer'),
    z.literal('git'),
    z.literal('package'),
    z.literal('path'),
    z.literal('vcs'),
  ]),
  packagist: z.boolean().optional(),
  'packagist.org': z.boolean().optional(),
  url: z.string().url(),
});
export type ComposerRepository = z.infer<typeof ComposerRepository>;

const ComposerRepositories = z.union([
  z.record(z.string(), z.union([ComposerRepository, z.boolean()])),
  z.array(ComposerRepository),
]);
export type ComposerRepositories = z.infer<typeof ComposerRepositories>;

export const ComposerConfig = z.object({
  type: z.string().optional(),
  /**
   * Setting a fixed PHP version (e.g. {"php": "7.0.3"}) will let you fake the
   * platform version so that you can emulate a production env or define your
   * target platform in the config.
   * See https://getcomposer.org/doc/06-config.md#platform
   */
  config: z
    .object({ platform: z.object({ php: z.string().optional() }).optional() })
    .optional(),
  /**
   * A repositories field can be an array of Repo objects or an object of repoName: Repo
   * Also it can be a boolean (usually false) to disable packagist.
   * (Yes this can be confusing, as it is also not properly documented in the composer docs)
   * See https://getcomposer.org/doc/05-repositories.md#disabling-packagist-org
   */
  repositories: ComposerRepositories.optional(),
  require: z.record(z.string(), z.string()).optional(),
  'require-dev': z.record(z.string(), z.string()).optional(),
});
export type ComposerConfig = z.infer<typeof ComposerConfig>;
