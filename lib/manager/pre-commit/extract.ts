import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import {
  PLATFORM_TYPE_GITEA,
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';
import { id as githubTagsId } from '../../datasource/github-tags';
import { id as gitlabTagsId } from '../../datasource/gitlab-tags';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { find } from '../../util/host-rules';
import { regEx } from '../../util/regex';
import type { PackageDependency, PackageFile } from '../types';
import {
  matchesPrecommitConfigHeuristic,
  matchesPrecommitDependencyHeuristic,
} from './parsing';
import { PreCommitConfig } from './types';

function isEmptyObject(obj: any): boolean {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

/**
 * Determines the datasource(id) to be used for this dependency
 * @param repository the full git url, ie git@github.com/user/project.
 *        Used in debug statements to clearly indicate the related dependency.
 * @param hostName the hostname (ie github.com)
 *        Used to determine which renovate datasource should be used.
 *        Is matched literally against `github.com` and `gitlab.com`.
 *        If that doesn't match, `hostRules.find()` is used to find related sources.
 *        In that case, the hostname is passed on as registryUrl to the corresponding datasource.
 */
function determineDatasource(
  repository: string,
  hostName: string
): { datasource?: string; registryUrls?: string[]; skipReason?: SkipReason } {
  if (hostName === 'github.com') {
    logger.debug({ repository, hostName }, 'Found github dependency');
    return { datasource: githubTagsId };
  }
  if (hostName === 'gitlab.com') {
    logger.debug({ repository, hostName }, 'Found gitlab dependency');
    return { datasource: gitlabTagsId };
  }
  const hostUrl = 'https://' + hostName;
  const res = find({ url: hostUrl });
  if (isEmptyObject(res)) {
    // 1 check, to possibly prevent 3 failures in combined query of hostType & url.
    logger.debug(
      { repository, hostUrl },
      'Provided hostname does not match any hostRules. Ignoring'
    );
    return { skipReason: SkipReason.UnknownRegistry, registryUrls: [hostName] };
  }
  for (const [hostType, sourceId] of [
    [PLATFORM_TYPE_GITEA, gitlabTagsId],
    [PLATFORM_TYPE_GITHUB, githubTagsId],
    [PLATFORM_TYPE_GITLAB, gitlabTagsId],
  ]) {
    if (!isEmptyObject(find({ hostType, url: hostUrl }))) {
      logger.debug(
        { repository, hostUrl, hostType },
        `Provided hostname matches a ${hostType} hostrule.`
      );
      return { datasource: sourceId, registryUrls: [hostName] };
    }
  }
  logger.debug(
    { repository, registry: hostUrl },
    'Provided hostname did not match any of the hostRules of hostType gitea,github nor gitlab'
  );
  return { skipReason: SkipReason.UnknownRegistry, registryUrls: [hostName] };
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
  logger.debug({ tag }, 'Found version');

  const urlMatchers = [
    // This splits "http://my.github.com/user/repo" -> "my.github.com" "user/repo
    regEx('^https?:\\/\\/(?<hostName>[^\\/]+)\\/(?<depName>\\S*)'),
    // This splits "git@private.registry.com:user/repo" -> "private.registry.com" "user/repo
    regEx('^git@(?<hostName>[^:]+):(?<depName>\\S*)'),
  ];
  for (const urlMatcher of urlMatchers) {
    const match = urlMatcher.exec(repository);
    if (match) {
      const { hostName, depName } = match.groups;
      const sourceDef = determineDatasource(repository, hostName);
      return {
        ...sourceDef,
        depName,
        depType: 'repository',
        lookupName: depName,
        currentValue: tag,
      };
    }
  }
  logger.info(
    { repository },
    'Could not separate hostname from full dependency url.'
  );
  return {
    depName: undefined,
    depType: 'repository',
    datasource: undefined,
    lookupName: undefined,
    skipReason: SkipReason.InvalidUrl,
    currentValue: tag,
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

export function extractPackageFile(
  content: string,
  filename: string
): PackageFile | null {
  let parsedContent: Record<string, unknown> | PreCommitConfig;
  try {
    parsedContent = yaml.safeLoad(content, { json: true }) as any;
  } catch (err) {
    logger.debug({ filename, err }, 'Failed to parse pre-commit config YAML');
    return null;
  }
  if (!is.plainObject<Record<string, unknown>>(parsedContent)) {
    logger.warn(
      { filename },
      `Parsing of pre-commit config YAML returned invalid result`
    );
    return null;
  }
  if (!matchesPrecommitConfigHeuristic(parsedContent)) {
    logger.debug(
      { filename },
      `File does not look like a pre-commit config file`
    );
    return null;
  }
  try {
    const deps = findDependencies(parsedContent);
    if (deps.length) {
      logger.trace({ deps }, 'Found dependencies in pre-commit config');
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ filename, err }, 'Error scanning parsed pre-commit config');
  }
  return null;
}
