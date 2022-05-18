import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import { newlineRegex, regEx } from '../../../util/regex';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { isVersion } from '../../versioning/semver';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split(newlineRegex);

    for (const line of lines) {
      // Search each line for plugin names
      const depLineMatch = regEx(
        /^[\s-]*(?<depName>[^#\s]+)#(?<currentValue>[^:]+)/
      ).exec(line);

      if (depLineMatch?.groups) {
        const { depName, currentValue } = depLineMatch.groups;
        logger.trace('depLineMatch');
        let skipReason: SkipReason | undefined;
        let repo: string | undefined;
        logger.debug({ depName }, 'Found BuildKite plugin');
        // Plugins may simply be git repos. If so, we need to parse out the registry.
        const gitPluginMatch = regEx(
          /(ssh:\/\/git@|https:\/\/)(?<registry>[^/]+)\/(?<gitPluginName>.*)/
        ).exec(depName);
        if (gitPluginMatch?.groups) {
          logger.debug('Examining git plugin');
          const { registry, gitPluginName } = gitPluginMatch.groups;
          const gitDepName = gitPluginName.replace(regEx('\\.git$'), '');
          const dep: PackageDependency = {
            depName: gitDepName,
            currentValue: currentValue,
            registryUrls: ['https://' + registry],
            datasource: GithubTagsDatasource.id,
          };
          deps.push(dep);
          continue;
        } else if (isVersion(currentValue)) {
          const splitName = depName.split('/');
          if (splitName.length === 1) {
            repo = `buildkite-plugins/${depName}-buildkite-plugin`;
          } else if (splitName.length === 2) {
            repo = `${depName}-buildkite-plugin`;
          } else {
            logger.warn(
              { dependency: depName },
              'Something is wrong with BuildKite plugin name'
            );
            skipReason = 'invalid-dependency-specification';
          }
        } else {
          logger.debug({ currentValue }, 'Skipping non-pinned current version');
          skipReason = 'invalid-version';
        }
        const dep: PackageDependency = {
          depName,
          currentValue,
          skipReason,
        };
        if (repo) {
          dep.datasource = GithubTagsDatasource.id;
          dep.packageName = repo;
        }
        deps.push(dep);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting BuildKite plugins');
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}
