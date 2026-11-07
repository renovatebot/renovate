import { isObject, isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { regEx } from '../../../util/regex.ts';
import { Result } from '../../../util/result.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { isVersion } from '../../versioning/semver/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { knownPlugins } from './known-plugins.ts';
import { BuildkiteFile, type BuildkiteStep } from './schema.ts';

const pluginKeyRegex = regEx(/^(?<depName>[^#\s]+)#(?<currentValue>[^:]+)$/);
const gitPluginRegex = regEx(
  /(?:ssh:\/\/git@|https:\/\/)(?<registry>[^/]+)\/(?<gitPluginName>.*)/,
);
const gitSuffixRegex = regEx('\\.git$');
const pluginRepoSuffix = '-buildkite-plugin';
const officialPluginRepoOrg = 'buildkite-plugins';
const officialPluginRepoPrefix = `${officialPluginRepoOrg}/`;

interface ExtractedPlugin {
  dep: PackageDependency;
  /**
   * The key `knownPlugins` should be looked up by, e.g. `docker` or
   * `myorg/docker`, however the plugin was referenced in the pipeline -
   * `undefined` when the reference can't be mapped to one, e.g. a git-based
   * reference not ending in the conventional `-buildkite-plugin` repo
   * name suffix.
   */
  knownPluginKey: string | undefined;
}

/**
 * A git-hosted plugin is referenced by its repo path rather than the short
 * `name`/`org/name` form `knownPlugins` is keyed by, e.g.
 * `buildkite-plugins/docker-buildkite-plugin` or
 * `myorg/docker-buildkite-plugin`. This derives the equivalent short key
 * from that repo path, so a known plugin is still recognised when it's
 * referenced by git URL instead.
 */
function knownPluginKeyFromRepo(repo: string): string | undefined {
  if (!repo.endsWith(pluginRepoSuffix)) {
    return undefined;
  }
  const withoutSuffix = repo.slice(0, -pluginRepoSuffix.length);
  return withoutSuffix.startsWith(officialPluginRepoPrefix)
    ? withoutSuffix.slice(officialPluginRepoPrefix.length)
    : withoutSuffix;
}

function extractPluginDep(key: string): ExtractedPlugin | null {
  const match = pluginKeyRegex.exec(key);
  if (!match?.groups) {
    return null;
  }
  const { depName, currentValue } = match.groups;
  logger.trace(`Found Buildkite plugin ${depName}`);

  // Plugins may simply be git repos. If so, we need to parse out the registry.
  const gitPluginMatch = gitPluginRegex.exec(depName);
  if (gitPluginMatch?.groups) {
    const { registry, gitPluginName } = gitPluginMatch.groups;
    const gitDepName = gitPluginName.replace(gitSuffixRegex, '');
    const datasource =
      registry === 'bitbucket.org'
        ? BitbucketTagsDatasource.id
        : GithubTagsDatasource.id;
    return {
      dep: {
        depName: gitDepName,
        currentValue,
        registryUrls: [`https://${registry}`],
        datasource,
      },
      knownPluginKey: knownPluginKeyFromRepo(gitDepName),
    };
  }

  if (!isVersion(currentValue)) {
    logger.debug(
      `Skipping non-pinned Buildkite current version ${currentValue}`,
    );
    return {
      dep: { depName, currentValue, skipReason: 'invalid-version' },
      knownPluginKey: depName,
    };
  }

  const splitName = depName.split('/');
  if (splitName.length === 1) {
    return {
      dep: {
        depName,
        currentValue,
        datasource: GithubTagsDatasource.id,
        packageName: `buildkite-plugins/${depName}-buildkite-plugin`,
      },
      knownPluginKey: depName,
    };
  }
  if (splitName.length === 2) {
    const [org, name] = splitName;
    return {
      dep: {
        depName,
        currentValue,
        datasource: GithubTagsDatasource.id,
        packageName: `${depName}-buildkite-plugin`,
      },
      // `buildkite-plugins/docker#v5.14.0` names the same plugin as the
      // bare short form `docker#v5.14.0` - normalise so both match the same
      // `knownPlugins` entry.
      knownPluginKey: org === officialPluginRepoOrg ? name : depName,
    };
  }

  logger.warn(
    { dependency: depName },
    'Something is wrong with Buildkite plugin name',
  );
  return {
    dep: {
      depName,
      currentValue,
      skipReason: 'invalid-dependency-specification',
    },
    knownPluginKey: depName,
  };
}

function extractKnownPluginDeps(
  depName: string | undefined,
  config: unknown,
  registryAliases: Record<string, string>,
): PackageDependency[] {
  if (!depName) {
    return [];
  }
  const known = knownPlugins[depName];
  if (!known || known.enabled === false) {
    return [];
  }
  return known.extract(config, registryAliases);
}

/**
 * Plugin refs are usually object keys of the form `name#version`, but a
 * plugin with no config can also be written as a bare array string, e.g.
 * `plugins: [docker-login#v2.0.1]` - valid per Buildkite's own pipeline
 * schema (`pluginsList` is `oneOf: [string, object(maxProperties: 1)]`).
 * A match can appear anywhere in the document (including outside any
 * `plugins:` block, e.g. behind a YAML anchor), so this walks every key
 * (and every bare string) of the raw parsed YAML value rather than relying
 * on a fixed schema shape. For a known plugin (see ./known-plugins.ts), the
 * plugin's own config (the key's value, or `undefined` for a bare string)
 * is also checked for a further embedded dependency, e.g. the `docker`
 * plugin's `image` key.
 */
function extractPluginDeps(
  node: unknown,
  deps: PackageDependency[],
  visited: WeakSet<object>,
  registryAliases: Record<string, string>,
): void {
  if (isString(node)) {
    const extracted = extractPluginDep(node);
    if (extracted) {
      deps.push(extracted.dep);
      deps.push(
        ...extractKnownPluginDeps(
          extracted.knownPluginKey,
          undefined,
          registryAliases,
        ),
      );
    }
    return;
  }

  if (!isObject(node)) {
    return;
  }
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      extractPluginDeps(item, deps, visited, registryAliases);
    }
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    const extracted = extractPluginDep(key);
    if (extracted) {
      deps.push(extracted.dep);
      deps.push(
        ...extractKnownPluginDeps(
          extracted.knownPluginKey,
          value,
          registryAliases,
        ),
      );
    }
    extractPluginDeps(value, deps, visited, registryAliases);
  }
}

function extractImage(
  image: string | undefined,
  deps: PackageDependency[],
  registryAliases: Record<string, string>,
): void {
  if (image) {
    deps.push(getDep(image, { registryAliases, depType: 'docker' }));
  }
}

function extractStepImages(
  steps: BuildkiteStep[],
  deps: PackageDependency[],
  registryAliases: Record<string, string>,
): void {
  for (const step of steps) {
    extractImage(step.image, deps, registryAliases);
    extractImage(step.agentsImage, deps, registryAliases);
    extractStepImages(step.steps, deps, registryAliases);
  }
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
  config?: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  const registryAliases = coerceObject(config?.registryAliases);

  let raw: unknown;
  try {
    // use YAML 1.1 so we can use anchor merge keys (`<<`)
    raw = parseSingleYaml(content, { version: '1.1' });
  } catch (err) {
    logger.debug({ err, packageFile }, 'Error parsing Buildkite pipeline YAML');
  }

  const { val: parsed, err } = Result.wrap(() =>
    BuildkiteFile.parse(raw),
  ).unwrap();
  if (err) {
    logger.debug({ err, packageFile }, 'Error extracting Buildkite images');
  } else {
    extractImage(parsed.image, deps, registryAliases);
    extractImage(parsed.agentsImage, deps, registryAliases);
    extractStepImages(parsed.steps, deps, registryAliases);
  }

  extractPluginDeps(raw, deps, new WeakSet(), registryAliases);

  if (!deps.length) {
    return null;
  }

  return { deps };
}
