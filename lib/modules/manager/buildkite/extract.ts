import { logger } from '../../../logger/index.ts';
import type { SkipReason } from '../../../types/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { isVersion } from '../../versioning/semver/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split(newlineRegex);

    for (const line of lines) {
      // Search each line for plugin names
      const depLineMatch = regEx(
        /^\s*(?:-\s+(?:\?\s+)?)?['"]?(?<depName>[^#\s'"]+)#(?<currentValue>[^:'"]+)['"]?/,
      ).exec(line);

      if (depLineMatch?.groups) {
        const { depName, currentValue } = depLineMatch.groups;
        logger.trace('depLineMatch');
        let skipReason: SkipReason | undefined;
        let repo: string | undefined;
        logger.trace(`Found Buildkite plugin ${depName}`);
        // Plugins may simply be git repos. If so, we need to parse out the registry.
        const gitPluginMatch = regEx(
          /(ssh:\/\/git@|https:\/\/)(?<registry>[^/]+)\/(?<gitPluginName>.*)/,
        ).exec(depName);
        if (gitPluginMatch?.groups) {
          logger.debug('Examining git plugin');
          const { registry, gitPluginName } = gitPluginMatch.groups;
          const gitDepName = gitPluginName.replace(regEx('\\.git$'), '');

          let datasource: string = GithubTagsDatasource.id;
          if (registry === 'bitbucket.org') {
            datasource = BitbucketTagsDatasource.id;
          }
          const dep: PackageDependency = {
            depName: gitDepName,
            currentValue,
            registryUrls: ['https://' + registry],
            datasource,
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
              'Something is wrong with Buildkite plugin name',
            );
            skipReason = 'invalid-dependency-specification';
          }
        } else {
          logger.debug(
            `Skipping non-pinned Buildkite current version ${currentValue}`,
          );
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
    logger.debug({ err, packageFile }, 'Error extracting Buildkite plugins');
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}
