import { z } from 'zod/v4';
import type { SkipReason } from '../../../types/index.ts';
import { regEx } from '../../../util/regex.ts';
import { Toml } from '../../../util/schema-utils/index.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';

/**
 * A proto TOML plugin definition. `[resolve] git-url` is the repository proto
 * reads versions (git tags) from; `[install] download-url` is only a fallback
 * for recovering that repository when `git-url` is absent.
 * @see https://moonrepo.dev/docs/proto/non-wasm-plugin
 */
export const ProtoPlugin = z.object({
  resolve: z.object({ 'git-url': z.string().optional() }).optional(),
  install: z.object({ 'download-url': z.string().optional() }).optional(),
});
export type ProtoPlugin = z.infer<typeof ProtoPlugin>;

export const ProtoPluginToml = Toml.pipe(ProtoPlugin);

/**
 * Result of resolving a plugin: either a fully-formed datasource config or a
 * skip. Modelled as a union so the "all fields present, or skipped" invariant is
 * enforced by the type rather than by scattered presence checks.
 */
export type ResolvedPlugin =
  | {
      datasource: string;
      packageName: string;
      registryUrl: string;
      skipReason?: never;
    }
  | { skipReason: SkipReason };

const hosts: Record<string, { datasource: string; registryUrl: string }> = {
  'github.com': {
    datasource: GithubTagsDatasource.id,
    registryUrl: 'https://github.com',
  },
  'gitlab.com': {
    datasource: GitlabTagsDatasource.id,
    registryUrl: 'https://gitlab.com',
  },
};

const repoUrlRegex = regEx(
  /^https?:\/\/(?<host>[^/]+)\/(?<repo>[^/]+\/[^/]+?)(?:\.git)?(?:\/|$)/,
);

/**
 * Derive a datasource config from a proto TOML plugin definition. proto reads
 * versions from the repository's git tags (`[resolve] git-url`), so a tool maps
 * to the github/gitlab tags datasource for that repository.
 */
export function resolvePluginConfig(plugin: ProtoPlugin): ResolvedPlugin {
  const repoUrl =
    plugin.resolve?.['git-url'] ?? plugin.install?.['download-url'];
  if (!repoUrl) {
    return { skipReason: 'unsupported-datasource' };
  }

  const match = repoUrlRegex.exec(repoUrl)?.groups;
  const host = match && hosts[match.host];
  if (!host) {
    return { skipReason: 'unsupported-url' };
  }

  return {
    datasource: host.datasource,
    packageName: match.repo,
    registryUrl: host.registryUrl,
  };
}
