import { isEmptyObject, isNonEmptyObject } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import type { SkipReason } from '../../../types/index.ts';
import { detectPlatform } from '../../../util/common.ts';
import { parseGitUrl } from '../../../util/git/url.ts';
import { find } from '../../../util/host-rules.ts';
import { regEx } from '../../../util/regex.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { parseLine } from '../gomod/line-parser.ts';
import { extractDependency as npmExtractDependency } from '../npm/extract/common/dependency.ts';
import { pep508ToPackageDependency } from '../pep621/utils.ts';
import type { PackageDependency } from '../types.ts';

const nodeDependencyRegex = regEx('^(?<name>.+)@(?<range>.+)$');

type GitDependencyMetadata = Pick<
  PackageDependency,
  | 'datasource'
  | 'depName'
  | 'depType'
  | 'packageName'
  | 'registryUrls'
  | 'skipReason'
>;

export interface HookAdditionalDependencies {
  additional_dependencies?: string[];
  language?: string;
}

/**
 * Determines the datasource(id) to be used for this dependency
 * @param repository the full git url, ie git@github.com/user/project.
 *        Used in debug statements to clearly indicate the related dependency.
 * @param hostname the hostname (ie github.com)
 *        Used to determine which renovate datasource should be used.
 *        Is matched literally against `github.com` and `gitlab.com`.
 *        If that doesn't match, `hostRules.find()` is used to find related sources.
 *        In that case, the hostname is passed on as registryUrl to the corresponding datasource.
 */
function determineDatasource(
  repository: string,
  hostname: string,
): { datasource?: string; registryUrls?: string[]; skipReason?: SkipReason } {
  const hostUrl = 'https://' + hostname;
  const platform = detectPlatform(repository) ?? detectPlatform(hostUrl);

  if (hostname === 'github.com') {
    logger.debug({ repository, hostname }, 'Found github dependency');
    return { datasource: GithubTagsDatasource.id };
  }
  if (platform === 'github') {
    logger.debug(
      { repository, hostname },
      'Found github dependency with custom registryUrl',
    );
    return {
      datasource: GithubTagsDatasource.id,
      registryUrls: ['https://' + hostname],
    };
  }
  if (hostname === 'gitlab.com') {
    logger.debug({ repository, hostname }, 'Found gitlab dependency');
    return { datasource: GitlabTagsDatasource.id };
  }
  if (platform === 'gitlab') {
    logger.debug(
      { repository, hostname },
      'Found gitlab dependency with custom registryUrl',
    );
    return {
      datasource: GitlabTagsDatasource.id,
      registryUrls: ['https://' + hostname],
    };
  }
  const res = find({ url: hostUrl });
  if (isEmptyObject(res)) {
    // 1 check, to possibly prevent 3 failures in combined query of hostType & url.
    logger.debug(
      { repository, hostUrl },
      'Provided hostname does not match any hostRules. Ignoring',
    );
    return { skipReason: 'unknown-registry', registryUrls: [hostUrl] };
  }
  for (const [hostType, sourceId] of [
    ['github', GithubTagsDatasource.id],
    ['gitlab', GitlabTagsDatasource.id],
  ]) {
    if (isNonEmptyObject(find({ hostType, url: hostUrl }))) {
      logger.debug(
        { repository, hostUrl, hostType },
        `Provided hostname matches a ${hostType} hostrule.`,
      );
      return { datasource: sourceId, registryUrls: [hostUrl] };
    }
  }
  logger.debug(
    { repository, registry: hostUrl },
    'Provided hostname did not match any of the hostRules of hostType github nor gitlab',
  );
  return { skipReason: 'unknown-registry', registryUrls: [hostUrl] };
}

export function extractGitDependencyMetadata(
  repository: string,
): GitDependencyMetadata {
  try {
    const parsedRepository = parseGitUrl(repository);
    const hostname = parsedRepository.host;
    const depName = parsedRepository.full_name;
    if (!hostname || !depName) {
      throw new Error('Could not extract hostname and dependency name');
    }

    const sourceDef = determineDatasource(repository, hostname);
    return {
      ...sourceDef,
      depName,
      depType: 'repository',
      packageName: depName,
    };
  } catch {
    logger.info(
      { repository },
      'Could not separate hostname from full dependency url.',
    );
    return {
      depName: undefined,
      depType: 'repository',
      datasource: undefined,
      packageName: undefined,
      skipReason: 'invalid-url',
    };
  }
}

export function extractGitDependency(
  currentValue: string,
  repository: string,
): PackageDependency {
  logger.debug(`Found version ${currentValue}`);

  return {
    ...extractGitDependencyMetadata(repository),
    currentValue,
  };
}

export function extractPreCommitAdditionalDependencies(
  hook: HookAdditionalDependencies,
): PackageDependency[] {
  const dependencies = hook.additional_dependencies;
  if (!dependencies?.length || !hook.language) {
    return [];
  }

  const packageDependencies: PackageDependency[] = [];
  if (hook.language === 'node') {
    for (const req of dependencies) {
      const match = nodeDependencyRegex.exec(req);
      if (!match?.groups) {
        continue;
      }

      const depType = 'pre-commit-node';
      const dep = npmExtractDependency(
        depType,
        match.groups.name,
        match.groups.range,
      );
      packageDependencies.push({
        depType,
        depName: match.groups.name,
        packageName: match.groups.name,
        ...dep,
      });
    }
  } else if (hook.language === 'python') {
    for (const req of dependencies) {
      const dep = pep508ToPackageDependency('pre-commit-python', req);
      if (dep) {
        packageDependencies.push(dep);
      }
    }
  } else if (hook.language === 'golang') {
    for (const req of dependencies) {
      const requireLine = `require ${req.replace('@', ' ')}`;
      const dep = parseLine(requireLine);
      if (dep) {
        packageDependencies.push({
          ...dep,
          depType: 'pre-commit-golang',
        });
      }
    }
  }

  return packageDependencies;
}
