import { z } from 'zod/v4';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';

type KnownPluginExtractor = (
  config: unknown,
  registryAliases: Record<string, string>,
) => PackageDependency[];

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
 * (unscoped) name as written in the pipeline, e.g. `docker#v5.14.0`. A
 * namespaced/third-party reference such as `myorg/docker#v1.0.0` is a
 * different plugin and deliberately doesn't match here.
 *
 * Modelled on ../github-actions/known-actions.
 */
export const knownPlugins: Record<string, KnownPluginExtractor> = {
  docker: extractDockerPluginDeps,
};
