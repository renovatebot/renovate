import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import { id as githubTagsId } from '../../datasource/github-tags';
import { id as gitlabTagsId } from '../../datasource/gitlab-tags';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { regEx } from '../../util/regex';
import { PackageDependency, PackageFile } from '../common';

import {
  matchesPrecommitConfigHeuristic,
  matchesPrecommitDependencyHeuristic,
} from './parsing';
import { PreCommitConfig } from './types';

function determineDatasource(
  repository: string,
  domain: string
): { datasource?: string; registryUrls?: string[] } {
  if (domain === 'github.com') {
    logger.debug({ repository, domain }, 'Found github dependency');
    return { datasource: githubTagsId };
  }
  if (domain === 'gitlab.com') {
    logger.debug({ repository, domain }, 'Found gitlab dependency');
    return { datasource: gitlabTagsId };
  }
  logger.debug(
    { repository, domain },
    'Not github.com or gitlab.com, assuming private gitlab-ee.'
  );
  return { datasource: gitlabTagsId, registryUrls: [domain] };
}

function extractDependency(
  tag: string,
  repository: string
): {
  depName?: string;
  depType?: string;
  datasource?: string;
  lookupName?: string;
  skipReason?: SkipReason;
  currentValue?: string;
} {
  let lookupName;
  const currentValue = tag;
  logger.debug({ tag }, 'Found version');

  const urlMatchers = [
    // This splits "http://github.com/user/repo" -> "github.com" "user/repo
    regEx('^https?:\\/\\/(?<domain>[^\\/]+)\\/(?<depName>\\S*)'),
    // This splits "git@domain.com:user/repo" -> "domain.com" "user/repo
    regEx('^git@(?<domain>[^:]+):(?<depName>\\S*)'),
  ];
  for (const urlMatcher of urlMatchers) {
    const match = urlMatcher.exec(repository);
    if (match) {
      const { domain, depName } = match.groups;
      lookupName = depName;
      const sourceDef = determineDatasource(repository, domain);
      return {
        ...sourceDef,
        depName: lookupName,
        depType: 'repository',
        lookupName,
        currentValue,
      };
    }
  }
  logger.info({ repository }, 'Could not separate host from lookup name.');
  return {
    depName: undefined,
    depType: 'repository',
    datasource: undefined,
    lookupName: undefined,
    skipReason: SkipReason.InvalidUrl,
    currentValue,
  };
}

/**
 * Find all supported dependencies in the pre-commit yaml object.
 *
 * @param precommitFile the parsed yaml config file
 */
function findDependencies(
  precommitFile: PreCommitConfig
): Array<PackageDependency> {
  if (!precommitFile.repos) {
    logger.debug(`No repos section found, skipping file`);
    return [];
  }
  const packageDependencies = [];
  precommitFile.repos.forEach((item) => {
    if (matchesPrecommitDependencyHeuristic(item)) {
      logger.trace(item, 'Matched pre-commit dependency spec');
      const repository = String(item.repo);
      const tag = String(item.rev);
      const dep = extractDependency(tag, repository);

      packageDependencies.push(dep);
    } else {
      logger.trace(item, 'Did not find pre-commit repo spec');
    }
  });
  return packageDependencies;
}

export function extractPackageFile(content: string): PackageFile | null {
  let parsedContent: Record<string, unknown> | PreCommitConfig;
  try {
    parsedContent = yaml.safeLoad(content, { json: true }) as any;
  } catch (err) {
    logger.debug({ err }, 'Failed to parse pre-commit config YAML');
    return null;
  }
  if (!is.plainObject<Record<string, unknown>>(parsedContent)) {
    logger.warn(`Parsing of pre-commit config YAML returned invalid result`);
    return null;
  }
  if (!matchesPrecommitConfigHeuristic(parsedContent)) {
    logger.info(`File does not look like a pre-commit config file`);
    return null;
  }
  try {
    const deps = findDependencies(parsedContent);
    if (deps.length) {
      logger.debug({ deps }, 'Found dependencies in pre-commit config');
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Error scanning parsed pre-commit config');
  }
  return null;
}
