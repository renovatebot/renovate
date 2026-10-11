import { isObject } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { isVersion } from '../../versioning/semver/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

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

/**
 * Plugin refs are object keys of the form `name#version`, and can appear
 * anywhere in the document (including outside any `plugins:` block, e.g.
 * behind a YAML anchor), so this walks every key of the raw parsed YAML
 * value rather than relying on a fixed schema shape.
 */
function extractPluginDeps(
  node: unknown,
  deps: PackageDependency[],
  visited: WeakSet<object>,
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
      extractPluginDeps(item, deps, visited);
    }
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    const dep = extractPluginDep(key);
    if (dep) {
      deps.push(dep);
    }
    extractPluginDeps(value, deps, visited);
  }
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  let raw: unknown;
  try {
    // use YAML 1.1 so we can use anchor merge keys (`<<`)
    raw = parseSingleYaml(content, { version: '1.1' });
  } catch (err) {
    logger.debug({ err, packageFile }, 'Error parsing Buildkite pipeline YAML');
  }

  extractPluginDeps(raw, deps, new WeakSet());

  if (!deps.length) {
    return null;
  }

  return { deps };
}
