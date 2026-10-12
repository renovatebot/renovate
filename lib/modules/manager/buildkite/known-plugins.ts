import { z } from 'zod/v4';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';
import type { KnownPlugin, KnownPluginExtractor } from './types.ts';

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
 * A plugin whose config has a single free-form field holding a complete
 * Docker image reference (as written, including any tag/digest) - the
 * field's own text is already a literal substring of the file, so `getDep`
 * can be used directly.
 */
function extractSingleImageField(field: string): KnownPluginExtractor {
  const schema = z.object({ [field]: z.string().optional() });
  return (config, registryAliases) => {
    const parsed = schema.safeParse(config);
    const image = parsed.success ? parsed.data[field] : undefined;
    if (!image) {
      return [];
    }
    return [getDep(image, { registryAliases, depType: 'docker' })];
  };
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
  // https://github.com/buildkite-plugins/docker-compose-buildkite-plugin
  'docker-compose': {
    extract: extractSingleImageField('run-image'),
    fields: ['run-image'],
  },
  // https://github.com/buildkite-plugins/docker-cache-buildkite-plugin
  // `image` is the name of the image this plugin *builds and caches*
  // (`lib/shared.bash` pushes it as `<registry>/<image>:<cache-key>`), not
  // something it pulls - it's an output, not a dependency. Left disabled.
  'docker-cache': {
    extract: extractSingleImageField('image'),
    enabled: false,
    fields: ['image'],
  },
};
