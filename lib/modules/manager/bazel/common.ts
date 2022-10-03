import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import parseGithubUrl from 'github-url-from-git';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import { DockerDatasource } from '../../datasource/docker';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GoDatasource } from '../../datasource/go';
import { id as dockerVersioning } from '../../versioning/docker';
import type { PackageDependency } from '../types';
import type { RuleMeta, Target, UrlParsedResult } from './types';

export function parseArchiveUrl(
  urlString: string | undefined | null
): UrlParsedResult | null {
  if (!urlString) {
    return null;
  }
  const url = parseUrl(urlString);
  if (!url || url.host !== 'github.com' || !url.pathname) {
    return null;
  }
  const path = url.pathname.split('/').slice(1);
  const repo = path[0] + '/' + path[1];
  let datasource = '';
  let currentValue: string | null = null;
  if (path[2] === 'releases' && path[3] === 'download') {
    datasource = GithubReleasesDatasource.id;
    currentValue = path[4];
  } else if (
    path[2] === 'archive' &&
    path[3] === 'refs' &&
    path[4] === 'tags'
  ) {
    datasource = GithubTagsDatasource.id;
    currentValue = path[5];
  } else if (path[2] === 'archive') {
    datasource = GithubTagsDatasource.id;
    currentValue = path[3];
  }

  if (currentValue) {
    // Strip archive extension to get hash or tag.
    // Tolerates formats produced by Git(Hub|Lab) and allowed by http_archive
    // Note: Order matters in suffix list to strip, e.g. .tar.gz.
    for (const extension of ['.gz', '.bz2', '.xz', '.tar', '.tgz', '.zip']) {
      if (currentValue.endsWith(extension)) {
        currentValue = currentValue.slice(0, -extension.length);
      }
    }

    return { datasource, repo, currentValue };
  }
  return null;
}

export function gitDependency({
  rule: depType,
  name: depName,
  tag: currentValue,
  commit: currentDigest,
  remote,
}: Target): PackageDependency | null {
  let dep: PackageDependency | null = null;

  if (
    depType === 'git_repository' &&
    is.string(depName) &&
    (is.string(currentValue) || is.string(currentDigest)) &&
    is.string(remote)
  ) {
    dep = {
      datasource: GithubReleasesDatasource.id,
      depType,
      depName,
    };

    if (is.string(currentValue)) {
      dep.currentValue = currentValue;
    }

    if (is.string(currentDigest)) {
      dep.currentDigest = currentDigest;
    }

    // TODO: Check if we really need to use parse here or if it should always be a plain https url (#9605)
    const packageName = parseGithubUrl(remote)?.substring(
      'https://github.com/'.length
    );

    // istanbul ignore else
    if (packageName) {
      dep.packageName = packageName;
    } else {
      dep.skipReason = 'unsupported-remote';
    }
  }

  return dep;
}

export function goDependency({
  rule: depType,
  name: depName,
  tag: currentValue,
  commit: currentDigest,
  importpath: packageName,
  remote,
}: Target): PackageDependency | null {
  let dep: PackageDependency | null = null;

  if (
    depType === 'go_repository' &&
    is.string(depName) &&
    (is.string(currentValue) || is.string(currentDigest)) &&
    is.string(packageName)
  ) {
    dep = {
      datasource: GoDatasource.id,
      depType,
      depName,
      packageName,
    };

    if (is.string(currentValue)) {
      dep.currentValue = currentValue;
    }

    if (is.string(currentDigest)) {
      dep.currentValue = 'v0.0.0';
      dep.currentDigest = currentDigest;
      dep.currentDigestShort = currentDigest.substring(0, 7);
      dep.digestOneAndOnly = true;
    }

    if (is.string(remote)) {
      const remoteMatch = regEx(
        /https:\/\/github\.com(?:.*\/)(([a-zA-Z]+)([-])?([a-zA-Z]+))/
      ).exec(remote);
      if (remoteMatch && remoteMatch[0].length === remote.length) {
        dep.packageName = remote.replace('https://', '');
      } else {
        dep.skipReason = 'unsupported-remote';
      }
    }
  }

  return dep;
}

export function httpDependency({
  rule: depType,
  name: depName,
  url,
  urls,
  sha256,
}: Target): PackageDependency | null {
  let dep: PackageDependency | null = null;

  if (
    (depType === 'http_archive' || depType === 'http_file') &&
    is.string(depName) &&
    is.string(sha256)
  ) {
    let parsedUrl: UrlParsedResult | null = null;
    if (is.string(url)) {
      parsedUrl = parseArchiveUrl(url);
    } else if (is.array(urls, is.string)) {
      for (const u of urls) {
        parsedUrl = parseArchiveUrl(u);
        if (parsedUrl) {
          break;
        }
      }
    }

    if (parsedUrl) {
      dep = {
        datasource: parsedUrl.datasource,
        depType,
        depName,
        packageName: parsedUrl.repo,
      };

      if (regEx(/^[a-f0-9]{40}$/i).test(parsedUrl.currentValue)) {
        dep.currentDigest = parsedUrl.currentValue;
      } else {
        dep.currentValue = parsedUrl.currentValue;
      }
    }
  }

  return dep;
}

export function dockerDependency({
  rule: depType,
  name: depName,
  tag: currentValue,
  digest: currentDigest,
  repository: packageName,
  registry,
}: Target): PackageDependency | null {
  let dep: PackageDependency | null = null;

  if (
    depType === 'container_pull' &&
    is.string(depName) &&
    is.string(currentValue) &&
    is.string(currentDigest) &&
    is.string(packageName) &&
    is.string(registry)
  ) {
    dep = {
      datasource: DockerDatasource.id,
      versioning: dockerVersioning,
      depType,
      depName,
      packageName,
      currentValue,
      currentDigest,
      registryUrls: [registry],
    };
  }

  return dep;
}

type DependencyExtractor = (_: Target) => PackageDependency | null;
type DependencyExtractorRegistry = Record<string, DependencyExtractor>;

const dependencyExtractorRegistry: DependencyExtractorRegistry = {
  git_repository: gitDependency,
  go_repository: goDependency,
  http_archive: httpDependency,
  http_file: httpDependency,
  container_pull: dockerDependency,
};

const supportedRules = Object.keys(dependencyExtractorRegistry);

export const supportedRulesRegex = regEx(`^${supportedRules.join('|')}$`);

export function extractDepFromTarget(target: Target): PackageDependency | null {
  const dependencyExtractor = dependencyExtractorRegistry[target.rule];
  if (!dependencyExtractor) {
    logger.debug(
      `Bazel dependency extractor function not found for ${target.rule}`
    );
    return null;
  }
  return dependencyExtractor(target);
}

// TODO: remove it (#9667)
export function getRuleDefinition(
  content: string,
  meta: RuleMeta[],
  ruleIndex: number
): string | null {
  let result: string | null = null;

  const rulePath = [ruleIndex];
  const ruleMeta = meta.find(({ path }) => dequal(path, rulePath));
  if (ruleMeta) {
    const {
      data: { offset, length },
    } = ruleMeta;
    const begin = offset;
    const end = offset + length;
    result = content.slice(begin, end);
  }

  return result;
}
