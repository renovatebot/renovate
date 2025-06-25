import is from '@sindresorhus/is';
import type { Document } from 'yaml';
import { isMap, isScalar, isSeq } from 'yaml';
import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import { detectPlatform } from '../../../util/common';
import { find } from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { parseSingleYamlDocument } from '../../../util/yaml';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
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

function extractDependency(
  tag: string,
  repository: string,
  comment?: string,
): PackageDependency {
  let currentValue = tag;
  let currentDigest: string | undefined;

  if (tag.length === 40 && comment) {
    const match = /.*frozen: (.+)$/.exec(comment);
    if (match?.[1]) {
      currentValue = match[1];
      currentDigest = tag;
    }
  }

  logger.debug(`Found version ${currentValue}`);

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
      const depName = match.groups.depName.replace(regEx(/\.git$/i), ''); // TODO 12071
      const sourceDef = determineDatasource(repository, hostname);
      const dep: PackageDependency = {
        ...sourceDef,
        depName,
        depType: 'repository',
        packageName: depName,
        currentValue,
      };
      if (currentDigest) {
        dep.currentDigest = currentDigest;
        dep.replaceString = `${currentDigest} # frozen: ${currentValue}`;
      }
      return dep;
    }
  }
  logger.info(
    { repository },
    'Could not separate hostname from full dependency url.',
  );
  const dep: PackageDependency = {
    depName: undefined,
    depType: 'repository',
    datasource: undefined,
    packageName: undefined,
    skipReason: 'invalid-url',
    currentValue,
  };
  if (currentDigest) {
    dep.currentDigest = currentDigest;
    dep.replaceString = `${currentDigest} # frozen: ${currentValue}`;
  }
  return dep;
}

/**
 * Find all supported dependencies in the pre-commit yaml object.
 *
 * @param precommitFile the parsed yaml config file
 * @param doc the YAML Document AST (optional, for comment extraction)
 */
function findDependencies(
  precommitFile: PreCommitConfig,
  doc?: Document,
): PackageDependency[] {
  if (!precommitFile.repos) {
    logger.debug(`No repos section found, skipping file`);
    return [];
  }
  const packageDependencies: PackageDependency[] = [];

  // Map for quick lookup of comments by repo index
  const repoComments: Record<number, string | undefined> = {};
  if (doc?.contents && isMap(doc.contents)) {
    const reposPair = doc.contents.items.find(
      (pair: any) => pair.key && pair.key.value === 'repos',
    );
    if (reposPair?.value && isSeq(reposPair.value)) {
      reposPair.value.items.forEach((repoItem: any, idx: number) => {
        if (repoItem && isMap(repoItem)) {
          const revPair = repoItem.items.find(
            (pair: any) => pair.key && pair.key.value === 'rev',
          );
          if (
            revPair?.value &&
            isScalar(revPair.value) &&
            typeof revPair.value.comment === 'string'
          ) {
            repoComments[idx] = revPair.value.comment;
          }
        }
      });
    }
  }

  precommitFile.repos.forEach((item, idx) => {
    // meta hooks is defined from pre-commit and doesn't support `additional_dependencies`
    if (item.repo !== 'meta') {
      item.hooks?.forEach((hook) => {
        // normally language are not defined in yaml
        // only support it when it's explicitly defined.
        // this avoid to parse hooks from pre-commit-hooks.yaml from git repo
        if (hook.language === 'python') {
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
      const dep = extractDependency(tag, repository, repoComments[idx]);
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
  let parsedContent: Record<string, unknown>;
  let doc: Document;

  try {
    // TODO: use schema (#9610)
    doc = parseSingleYamlDocument(content);
    parsedContent = doc.toJS({ maxAliasCount: 10000 });
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
    const deps = findDependencies(parsedContent, doc);
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
