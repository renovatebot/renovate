import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import { detectPlatform } from '../../../util/common';
import { find } from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { parseSingleYaml } from '../../../util/yaml';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { extractDependency as npmExtractDependency } from '../npm/extract/common/dependency';
import { pep508ToPackageDependency } from '../pep621/utils';
import type { PackageDependency, PackageFileContent } from '../types';
import {
  matchesPrecommitConfigHeuristic,
  matchesPrecommitDependencyHeuristic,
} from './parsing';
import type { PreCommitConfig } from './types';

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
  if (hostname === 'github.com' || detectPlatform(repository) === 'github') {
    logger.debug({ repository, hostname }, 'Found github dependency');
    return { datasource: GithubTagsDatasource.id };
  }
  if (hostname === 'gitlab.com') {
    logger.debug({ repository, hostname }, 'Found gitlab dependency');
    return { datasource: GitlabTagsDatasource.id };
  }
  if (detectPlatform(repository) === 'gitlab') {
    logger.debug(
      { repository, hostname },
      'Found gitlab dependency with custom registryUrl',
    );
    return {
      datasource: GitlabTagsDatasource.id,
      registryUrls: ['https://' + hostname],
    };
  }
  const hostUrl = 'https://' + hostname;
  const res = find({ url: hostUrl });
  if (is.emptyObject(res)) {
    // 1 check, to possibly prevent 3 failures in combined query of hostType & url.
    logger.debug(
      { repository, hostUrl },
      'Provided hostname does not match any hostRules. Ignoring',
    );
    return { skipReason: 'unknown-registry', registryUrls: [hostname] };
  }
  for (const [hostType, sourceId] of [
    ['github', GithubTagsDatasource.id],
    ['gitlab', GitlabTagsDatasource.id],
  ]) {
    if (is.nonEmptyObject(find({ hostType, url: hostUrl }))) {
      logger.debug(
        { repository, hostUrl, hostType },
        `Provided hostname matches a ${hostType} hostrule.`,
      );
      return { datasource: sourceId, registryUrls: [hostname] };
    }
  }
  logger.debug(
    { repository, registry: hostUrl },
    'Provided hostname did not match any of the hostRules of hostType github nor gitlab',
  );
  return { skipReason: 'unknown-registry', registryUrls: [hostname] };
}

const gitUrlRegex = regEx(/\.git$/i);

function extractDependency(
  tag: string,
  repository: string,
): {
  depName?: string;
  depType?: string;
  datasource?: string;
  packageName?: string;
  skipReason?: SkipReason;
  currentValue?: string;
} {
  logger.debug(`Found version ${tag}`);

  const urlMatchers = [
    // This splits "http://my.github.com/user/repo" -> "my.github.com" "user/repo
    regEx('^https?://(?<hostname>[^/]+)/(?<depName>\\S*)'),
    // This splits "git@private.registry.com:user/repo" -> "private.registry.com" "user/repo
    regEx('^git@(?<hostname>[^:]+):(?<depName>\\S*)'),
    // This split "git://github.com/pre-commit/pre-commit-hooks" -> "github.com" "pre-commit/pre-commit-hooks"
    regEx(/^git:\/\/(?<hostname>[^/]+)\/(?<depName>\S*)/),
    // This splits "ssh://git@github.com/pre-commit/pre-commit-hooks" -> "github.com" "pre-commit/pre-commit-hooks"
    regEx(/^ssh:\/\/git@(?<hostname>[^/]+)\/(?<depName>\S*)/),
  ];
  for (const urlMatcher of urlMatchers) {
    const match = urlMatcher.exec(repository);
    if (match?.groups) {
      const hostname = match.groups.hostname;
      const depName = match.groups.depName.replace(gitUrlRegex, '');
      const sourceDef = determineDatasource(repository, hostname);
      return {
        ...sourceDef,
        depName,
        depType: 'repository',
        packageName: depName,
        currentValue: tag,
      };
    }
  }
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
    currentValue: tag,
  };
}

/**
 * Find all supported dependencies in the pre-commit yaml object.
 *
 * @param precommitFile the parsed yaml config file
 */
function findDependencies(precommitFile: PreCommitConfig): PackageDependency[] {
  if (!precommitFile.repos) {
    logger.debug(`No repos section found, skipping file`);
    return [];
  }
  const packageDependencies: PackageDependency[] = [];
  precommitFile.repos.forEach((item) => {
    // meta hooks is defined from pre-commit and doesn't support `additional_dependencies`
    if (item.repo !== 'meta') {
      item.hooks?.forEach((hook) => {
        // normally language are not defined in yaml
        // only support it when it's explicitly defined.
        // this avoid to parse hooks from pre-commit-hooks.yaml from git repo
        if (hook.language === 'node') {
          hook.additional_dependencies?.map((req) => {
            const match = regEx('^(?<name>.+)@(?<range>.+)$').exec(req);
            if (!match?.groups) {
              return;
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
          });
        } else if (hook.language === 'python') {
          hook.additional_dependencies?.map((req) => {
            const dep = pep508ToPackageDependency('pre-commit-python', req);
            if (dep) {
              packageDependencies.push(dep);
            }
          });
        }
      });
    }

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
  packageFile: string,
): PackageFileContent | null {
  type ParsedContent = Record<string, unknown> | PreCommitConfig;
  let parsedContent: ParsedContent;
  try {
    // TODO: use schema (#9610)
    parsedContent = parseSingleYaml(content);
  } catch (err) {
    logger.debug(
      { filename: packageFile, err },
      'Failed to parse pre-commit config YAML',
    );
    return null;
  }
  if (!is.plainObject<Record<string, unknown>>(parsedContent)) {
    logger.debug(
      { packageFile },
      `Parsing of pre-commit config YAML returned invalid result`,
    );
    return null;
  }
  if (!matchesPrecommitConfigHeuristic(parsedContent)) {
    logger.debug(
      { packageFile },
      `File does not look like a pre-commit config file`,
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
    logger.debug(
      { packageFile, err },
      'Error scanning parsed pre-commit config',
    );
  }
  return null;
}
