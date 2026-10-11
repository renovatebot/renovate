import { isObject } from '@sindresorhus/is';
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

function extractPluginDep(key: string): PackageDependency | null {
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
      depName: gitDepName,
      currentValue,
      registryUrls: [`https://${registry}`],
      datasource,
    };
  }

  if (!isVersion(currentValue)) {
    logger.debug(
      `Skipping non-pinned Buildkite current version ${currentValue}`,
    );
    return { depName, currentValue, skipReason: 'invalid-version' };
  }

  const splitName = depName.split('/');
  if (splitName.length === 1) {
    return {
      depName,
      currentValue,
      datasource: GithubTagsDatasource.id,
      packageName: `buildkite-plugins/${depName}-buildkite-plugin`,
    };
  }
  if (splitName.length === 2) {
    return {
      depName,
      currentValue,
      datasource: GithubTagsDatasource.id,
      packageName: `${depName}-buildkite-plugin`,
    };
  }

  logger.warn(
    { dependency: depName },
    'Something is wrong with Buildkite plugin name',
  );
  return {
    depName,
    currentValue,
    skipReason: 'invalid-dependency-specification',
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
 * Plugin refs are object keys of the form `name#version`, and can appear
 * anywhere in the document (including outside any `plugins:` block, e.g.
 * behind a YAML anchor), so this walks every key of the raw parsed YAML
 * value rather than relying on a fixed schema shape. For a known plugin
 * (see ./known-plugins.ts), the plugin's own config (the key's value) is
 * also checked for a further embedded dependency, e.g. the `docker`
 * plugin's `image` key.
 */
function extractPluginDeps(
  node: unknown,
  deps: PackageDependency[],
  visited: WeakSet<object>,
  registryAliases: Record<string, string>,
): void {
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
    const dep = extractPluginDep(key);
    if (dep) {
      deps.push(dep);
      deps.push(...extractKnownPluginDeps(dep.depName, value, registryAliases));
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
