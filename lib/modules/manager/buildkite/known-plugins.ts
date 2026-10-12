import { z } from 'zod/v4';
import { regEx } from '../../../util/regex.ts';
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
 * A plugin's own config field is rarely the *complete* text Renovate needs
 * to replace on update - e.g. a version/tag field is just `1.21`, while the
 * full dependency is conceptually `golang:1.21`. `getDep()` (built for
 * Dockerfile `FROM` lines) always sets `replaceString` to the *entire*
 * string passed in, which is wrong here: that joined/synthesised string
 * never appears literally in the YAML, so Renovate's auto-replace can never
 * find it and the update silently never applies.
 *
 * Instead, this derives `depName`/`packageName` via `getDep()` (so
 * registry-alias resolution, `quay.io`/`library/` prefix handling etc.
 * still apply to the image-name portion), but sets `currentValue` itself to
 * the literal field text and leaves `replaceString`/`autoReplaceStringTemplate`
 * unset - Renovate's own auto-replace fallback then uses `currentValue` as
 * the replace target (`lib/workers/repository/update/branch/auto-replace.ts`),
 * which *is* a literal substring of the file. This mirrors how
 * ../github-actions/known-actions's `parseValue`/`parseImageValue` handle a
 * `with:` input - they never set `replaceString` either.
 */
function depWithVersion(
  imageName: string,
  currentValue: string,
  registryAliases: Record<string, string>,
): PackageDependency {
  const dep = getDep(imageName, {
    registryAliases,
    depType: 'docker',
    specifyReplaceString: false,
  });
  dep.currentValue = currentValue;
  return dep;
}

/**
 * A plugin whose config has separate image-name and tag/version fields. If
 * the user's own `image` value already carries a tag/digest (`myorg/app:1`),
 * it's a complete, literal reference on its own - handled like
 * `extractSingleImageField`, ignoring `tagField` (joining a second tag onto
 * an already-tagged image would produce `myorg/app:1:2`, not a real
 * reference). Otherwise, `imageField` (or `defaultImage`, for a plugin with
 * a real, known default image name) names the dependency and `tagField`'s
 * literal text becomes `currentValue` (see `depWithVersion`) - `tagField`
 * absent means there's no version text to anchor a replace to, so nothing
 * is reported, even if the plugin has its own default tag.
 */
function extractImageTagJoin(
  imageField: string,
  tagField: string,
  defaultImage?: string,
): KnownPluginExtractor {
  const schema = z.object({
    [imageField]: z.string().optional(),
    [tagField]: z.string().optional(),
  });
  return (config, registryAliases) => {
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
      return [];
    }
    const rawImage = parsed.data[imageField];
    if (rawImage && regEx(/[:@]/).test(rawImage)) {
      return [getDep(rawImage, { registryAliases, depType: 'docker' })];
    }
    const image = rawImage ?? defaultImage;
    const tag = parsed.data[tagField];
    if (!image || !tag) {
      return [];
    }
    return [depWithVersion(image, tag, registryAliases)];
  };
}

/**
 * A plugin with a hardcoded backing Docker image, where the user only
 * supplies a version/tag via `versionField`. The field being absent means
 * there's no version text to anchor a replace to (even where the plugin's
 * own hook falls back to a default like `latest`), so nothing is reported.
 */
function extractFixedImageVersion(
  imageName: string,
  versionField: string,
): KnownPluginExtractor {
  const schema = z.object({ [versionField]: z.string().optional() });
  return (config, registryAliases) => {
    const parsed = schema.safeParse(config);
    const version = parsed.success ? parsed.data[versionField] : undefined;
    if (!version) {
      return [];
    }
    return [depWithVersion(imageName, version, registryAliases)];
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
  // https://github.com/buildkite-plugins/junit-annotate-buildkite-plugin
  // `ruby-image` is only used when `run-in-docker` is true (the default).
  'junit-annotate': {
    extract: whenTrue(
      'run-in-docker',
      true,
      extractSingleImageField('ruby-image'),
    ),
    fields: ['ruby-image', 'run-in-docker'],
  },
  // https://github.com/buildkite-plugins/shellcheck-buildkite-plugin
  // `image` defaults to `koalaman/shellcheck` (a known, fixed name) when
  // unset; `version` must be present as literal text to report anything.
  // Verified against `hooks/command` - the README's stated `version`
  // default of `latest` is stale; the real fallback is `stable`, but that
  // default isn't literal file text either, so we only report an explicit
  // `version`.
  shellcheck: {
    extract: extractImageTagJoin('image', 'version', 'koalaman/shellcheck'),
    fields: ['image', 'version'],
  },
  // https://github.com/buildkite-plugins/docker-image-push-buildkite-plugin
  // `image`/`tag` name a *local* image this plugin pushes to a registry
  // (README: "pushes an image that already exists in the local Docker
  // daemon") - an output, not a dependency. Left disabled.
  'docker-image-push': {
    extract: extractImageTagJoin('image', 'tag'),
    enabled: false,
    fields: ['image', 'tag'],
  },
  // https://github.com/grapl-security/codecov-buildkite-plugin (archived)
  // `image` has no real fallback in code (its `plugin.yml`'s stated default
  // is stale documentation); `tag` defaults to `latest` but that default
  // isn't literal file text, so only an explicit `tag` is reported.
  'grapl-security/codecov': {
    extract: extractImageTagJoin('image', 'tag'),
    fields: ['image', 'tag'],
  },
  // https://github.com/grapl-security/vault-login-buildkite-plugin (archived)
  // `image` defaults to `hashicorp/vault` - verified against `lib/vault.sh`.
  'grapl-security/vault-login': {
    extract: extractImageTagJoin('image', 'tag', 'hashicorp/vault'),
    fields: ['image', 'tag'],
  },
  // https://github.com/grapl-security/vault-env-buildkite-plugin (archived)
  // Same pattern as vault-login, verified against `hooks/environment`.
  'grapl-security/vault-env': {
    extract: extractImageTagJoin('image', 'tag', 'hashicorp/envconsul'),
    fields: ['image', 'tag'],
  },
  // https://github.com/buildkite-plugins/golang-buildkite-plugin
  golang: {
    extract: extractFixedImageVersion('golang', 'version'),
    fields: ['version'],
    dependency: 'golang',
  },
  // https://github.com/buildkite-plugins/ossf-scorecard-buildkite-plugin
  // Backing image is on GHCR, not Docker Hub - verified against
  // `hooks/command`.
  'ossf-scorecard': {
    extract: extractFixedImageVersion('ghcr.io/ossf/scorecard', 'version'),
    fields: ['version'],
    dependency: 'ghcr.io/ossf/scorecard',
  },
  // https://github.com/buildkite-plugins/plugin-linter-buildkite-plugin
  // Verified against `hooks/command`: the README's stated default of
  // `2.0.3` is stale - the real fallback is `v2.1.0`, but that default isn't
  // literal file text when `image-version` is unset, so we only report an
  // explicit value.
  'plugin-linter': {
    extract: extractFixedImageVersion(
      'buildkite/plugin-linter',
      'image-version',
    ),
    fields: ['image-version'],
    dependency: 'buildkite/plugin-linter',
  },
  // https://github.com/buildkite-plugins/plugin-tester-buildkite-plugin
  // Verified against `hooks/command`: the published Docker Hub image is
  // `buildkite/plugin-tester`, not `buildkite-plugins/buildkite-plugin-tester`
  // (the GitHub org path and the published image name differ).
  'plugin-tester': {
    extract: extractFixedImageVersion('buildkite/plugin-tester', 'version'),
    fields: ['version'],
    dependency: 'buildkite/plugin-tester',
  },
  // https://github.com/johnsyweb/markdownlint-buildkite-plugin
  'johnsyweb/markdownlint': {
    extract: extractFixedImageVersion('markdownlint/markdownlint', 'version'),
    fields: ['version'],
    dependency: 'markdownlint/markdownlint',
  },
};
