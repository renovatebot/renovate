import { z } from 'zod/v4';
import { Toml } from '../../../util/schema-utils/index.ts';

/**
 * The repository a proto TOML plugin reads versions (git tags) from:
 * `[resolve] git-url` in format v1, `git_url` in format v2.
 * @see https://moonrepo.dev/docs/proto/non-wasm-plugin
 */
export const ProtoPluginGitUrl = z
  .object({
    resolve: z
      .object({
        'git-url': z.string().optional(),
        git_url: z.string().optional(),
      })
      .optional(),
  })
  .transform(({ resolve }) => resolve?.['git-url'] ?? resolve?.git_url ?? null);

export const ProtoPluginGitUrlToml = Toml.pipe(ProtoPluginGitUrl);
