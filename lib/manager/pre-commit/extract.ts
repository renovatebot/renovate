import yaml from 'js-yaml';
import { forEach } from 'traverse';
import { id as githubTagsId } from '../../datasource/github-tags';
import { id as gitlabTagsId } from '../../datasource/gitlab-tags';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { PackageDependency, PackageFile } from '../common';

import {
  PrecommitGitDependency,
  hasKey,
  matchesPrecommitGitHeuristic,
} from './util';

function detectDatasource(hostName: string): { [key: string]: string } {
  let datasource;
  let skipReason;
  if (hostName.endsWith('github.com')) {
    datasource = githubTagsId;
    logger.debug({ hostName }, 'Found github dependency');
  } else if (hostName.endsWith('gitlab.com')) {
    datasource = gitlabTagsId;
    logger.debug({ hostName }, 'Found gitlab dependency');
  } else {
    logger.debug({ hostName }, 'No datasource specified for hostname');
    skipReason = SkipReason.UnsupportedUrl;
  }
  return { datasource, skipReason };
}

/**
 * Find all supported dependencies in the pre-commit yaml object.
 *
 * @param parsedContent the yaml loaded contents of the full pre-commit configuration yaml
 * @param packageDependencies the array to add found dependenciees to
 */
function findDependencies(
  parsedContent: Record<string, unknown> | PrecommitGitDependency,
  packageDependencies: Array<PackageDependency>
): Array<PackageDependency> {
  if (!parsedContent || typeof parsedContent !== 'object') {
    return packageDependencies;
  }

  if (hasKey('repos', parsedContent)) {
    const repos = parsedContent.repos;
    forEach(repos, (item) => {
      if (matchesPrecommitGitHeuristic(item)) {
        logger.trace(item, 'Matched pre-commit repo spec');
        const repository = String(item.repo);
        const tag = String(item.rev);

        let skipReason;
        let datasource;
        let lookupName;
        const currentValue = tag;
        logger.debug({ tag }, 'Found version');

        const urlMatchers = [
          // This splits "http://github.com/user/repo" -> "http://github" ".com" "user/repo
          /^(?<hostNamePrefix>.*)(?<domain>\.\w+)\/(?<depName>\S*)*/,
          // This splits "git@hostNamePrefix.com:user/repo" -> "hostNamePrefix" ".com" "user/repo
          /^git@(?<hostNamePrefix>.*)(?<domain>\.\w+):(?<depName>\S*)*/,
        ];
        let matched = false;
        for (const urlMatcher of urlMatchers) {
          const match = urlMatcher.exec(repository);
          if (match) {
            const { hostNamePrefix, domain, depName } = match.groups;
            const hostName = hostNamePrefix.concat(domain);
            lookupName = depName;
            const sourceDef = detectDatasource(hostName);
            datasource = sourceDef.datasource;
            skipReason = sourceDef.skipReason;
            matched = true;
            break;
          }
        }
        if (!matched) {
          logger.info(
            { repository },
            'Could not separate host from lookup name.'
          );
          skipReason = SkipReason.InvalidUrl;
        }

        const dep = {
          depName: lookupName,
          depType: 'repository',
          datasource,
          lookupName,
          skipReason,
          currentValue,
        };

        packageDependencies.push(dep);
      } else {
        logger.trace(item, 'Did not find pre-commit repo spec');
      }
    });
  }
  return packageDependencies;
}

export function extractPackageFile(content: string): PackageFile {
  let parsedContent: Record<string, unknown> | PrecommitGitDependency;
  try {
    // a parser that allows extracting line numbers would be preferable, with
    // the current approach we need to match anything we find again during the update
    // TODO: fix me
    parsedContent = yaml.safeLoad(content, { json: true }) as any;
  } catch (err) {
    logger.debug({ err }, 'Failed to parse pre-commit config YAML');
    return null;
  }
  try {
    const deps = findDependencies(parsedContent, []);
    if (deps.length) {
      logger.debug({ deps }, 'Found dependencies in pre-commit config');
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Error scanning parsed pre-commit config');
  }
  return null;
}
