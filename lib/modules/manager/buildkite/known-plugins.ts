import { z } from 'zod/v4';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';
import type { KnownPlugin } from './types.ts';

// https://github.com/buildkite-plugins/docker-buildkite-plugin
const DockerPluginConfig = z.object({ image: z.string().optional() });

function extractDockerPluginDeps(
  config: unknown,
  registryAliases: Record<string, string>,
): PackageDependency[] {
  const parsed = DockerPluginConfig.safeParse(config);
  if (!parsed.success || !parsed.data.image) {
    return [];
  }
  return [getDep(parsed.data.image, { registryAliases, depType: 'docker' })];
}

/**
 * Buildkite plugins whose own configuration embeds a further dependency (for
 * example the `docker` plugin's `image` key), keyed by the plugin's bare
 * (unscoped) name as written in the pipeline, e.g. `docker#v5.14.0`, or by
 * `org/name` for a third-party plugin, e.g. `seek-oss/aws-sm#v2.3.1`. A
 * fork/rename not listed here is a different plugin and deliberately
 * doesn't match.
 *
 * Modelled on ../github-actions/known-actions.
 */
export const knownPlugins: Record<string, KnownPlugin> = {
  docker: { extract: extractDockerPluginDeps, fields: ['image'] },
};
