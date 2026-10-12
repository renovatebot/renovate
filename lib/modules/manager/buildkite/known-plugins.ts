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
 * Wraps `inner` so it only runs when the given boolean config field is
 * (explicitly or by its own default) `true` - for a plugin whose image field
 * is only meaningful behind a boolean "use Docker for this" toggle.
 */
function whenTrue(
  gateField: string,
  gateDefault: boolean,
  inner: KnownPluginExtractor,
): KnownPluginExtractor {
  const schema = z.object({ [gateField]: z.boolean().optional() });
  return (config, registryAliases) => {
    const parsed = schema.safeParse(config);
    const enabled =
      (parsed.success ? parsed.data[gateField] : undefined) ?? gateDefault;
    return enabled ? inner(config, registryAliases) : [];
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
  // https://github.com/jameslnewell/docker-run-buildkite-plugin
  'jameslnewell/docker-run': {
    extract: extractSingleImageField('image'),
    fields: ['image'],
  },
  // https://github.com/oasislabs/docker-buildkite-plugin - a fork of the
  // official `docker` plugin, pinned to an older upstream snapshot that
  // predates the `chown`/`chown-image` feature, so only `image` applies.
  'oasislabs/docker': {
    extract: extractSingleImageField('image'),
    fields: ['image'],
  },
  // https://github.com/improbable-eng/docker-service-buildkite-plugin
  'improbable-eng/docker-service': {
    extract: extractSingleImageField('container'),
    fields: ['container'],
  },
  // https://github.com/equinixmetal-buildkite/kind-cluster-buildkite-plugin
  // `custom_image` overrides an internal, pinned `kindest/node` image
  // selected by the (non-Docker-reference) `k8s_version` field - only
  // `custom_image` is a user-configurable Docker dependency. Its
  // `kind_version`/`helm_version` fields pin separate CLI tools, not Docker
  // images - out of scope here.
  'equinixmetal-buildkite/kind-cluster': {
    extract: extractSingleImageField('custom_image'),
    fields: ['custom_image'],
  },
  // https://github.com/joscha/codecov-buildkite-plugin
  // Verified against `hooks/post-command` - the plugin's own default
  // (`buildpack-deps:jessie-scm`, used when `docker_image` is unset) isn't
  // literal text in the file, so it isn't reported; only an explicit value
  // is.
  'joscha/codecov': {
    extract: extractSingleImageField('docker_image'),
    fields: ['docker_image'],
  },
  // https://github.com/buildkite-plugins/golangci-lint-buildkite-plugin
  // `docker_image` is only used when `use_docker` is true (the default) -
  // verified against `plugin.yml`/`hooks/command`. The plugin's own default
  // image value (`golangci/golangci-lint:latest`) isn't literal text in the
  // file when `docker_image` is unset, so we don't report it.
  'golangci-lint': {
    extract: whenTrue(
      'use_docker',
      true,
      extractSingleImageField('docker_image'),
    ),
    fields: ['docker_image', 'use_docker'],
  },
};
