/* eslint no-plusplus: 0  */
import parse from 'github-url-from-git';
import { parse as _parse } from 'url';
import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';
import { regEx } from '../../util/regex';

interface UrlParsedResult {
  repo: string;
  currentValue: string;
}

function parseUrl(urlString: string): UrlParsedResult | null {
  // istanbul ignore if
  if (!urlString) {
    return null;
  }
  const url = _parse(urlString);
  if (url.host !== 'github.com') {
    return null;
  }
  const path = url.path.split('/').slice(1);
  const repo = path[0] + '/' + path[1];
  let currentValue: string = null;
  if (path[2] === 'releases' && path[3] === 'download') {
    currentValue = path[4];
  }
  if (path[2] === 'archive') {
    currentValue = path[3].replace(/\.tar\.gz$/, '');
  }
  if (currentValue) {
    return { repo, currentValue };
  }
  // istanbul ignore next
  return null;
}

function findBalancedParenIndex(longString: string): number {
  /**
   * Minimalistic string parser with single task -> find last char in def.
   * It treats [)] as the last char.
   * To find needed closing parenthesis we need to increment
   * nesting depth when parser feeds opening parenthesis
   * if one opening parenthesis -> 1
   * if two opening parenthesis -> 2
   * if two opening and one closing parenthesis -> 1
   * if ["""] finded then ignore all [)] until closing ["""] parsed.
   * https://github.com/renovatebot/renovate/pull/3459#issuecomment-478249702
   */
  let intShouldNotBeOdd = 0; // openClosePythonMultiLineComment
  let parenNestingDepth = 1;
  return [...longString].findIndex((char, i, arr) => {
    switch (char) {
      case '(':
        parenNestingDepth++;
        break;
      case ')':
        parenNestingDepth--;
        break;
      case '"':
        if (i > 1 && arr.slice(i - 2, i).every(prev => char === prev))
          intShouldNotBeOdd++;
        break;
      default:
        break;
    }

    return !parenNestingDepth && !(intShouldNotBeOdd % 2) && char === ')';
  });
}

function parseContent(content: string): string[] {
  return [
    'container_pull',
    'http_archive',
    'go_repository',
    'git_repository',
  ].reduce(
    (acc, prefix) => [
      ...acc,
      ...content
        .split(regEx(prefix + '\\s*\\(', 'g'))
        .slice(1)
        .map(base => {
          const ind = findBalancedParenIndex(base);

          return ind >= 0 && `${prefix}(${base.slice(0, ind)})`;
        })
        .filter(Boolean),
    ],
    [] as string[]
  );
}

export function extractPackageFile(content: string): PackageFile | null {
  const definitions = parseContent(content);
  if (!definitions.length) {
    logger.debug('No matching WORKSPACE definitions found');
    return null;
  }
  logger.debug({ definitions }, `Found ${definitions.length} definitions`);
  const deps: PackageDependency[] = [];
  definitions.forEach(def => {
    logger.debug({ def }, 'Checking bazel definition');
    const [depType] = def.split('(', 1);
    const dep: PackageDependency = { depType, managerData: { def } };
    let depName: string;
    let importpath: string;
    let remote: string;
    let currentValue: string;
    let commit: string;
    let url: string;
    let sha256: string;
    let digest: string;
    let repository: string;
    let registry: string;
    let match = def.match(/name\s*=\s*"([^"]+)"/);
    if (match) {
      [, depName] = match;
    }
    match = def.match(/digest\s*=\s*"([^"]+)"/);
    if (match) {
      [, digest] = match;
    }
    match = def.match(/registry\s*=\s*"([^"]+)"/);
    if (match) {
      [, registry] = match;
    }
    match = def.match(/repository\s*=\s*"([^"]+)"/);
    if (match) {
      [, repository] = match;
    }
    match = def.match(/remote\s*=\s*"([^"]+)"/);
    if (match) {
      [, remote] = match;
    }
    match = def.match(/tag\s*=\s*"([^"]+)"/);
    if (match) {
      [, currentValue] = match;
    }
    match = def.match(/url\s*=\s*"([^"]+)"/);
    if (match) {
      [, url] = match;
    }
    match = def.match(/urls\s*=\s*\[\s*"([^\]]+)",?\s*\]/);
    if (match) {
      const urls = match[1].replace(/\s/g, '').split('","');
      url = urls.find(parseUrl);
    }
    match = def.match(/commit\s*=\s*"([^"]+)"/);
    if (match) {
      [, commit] = match;
    }
    match = def.match(/sha256\s*=\s*"([^"]+)"/);
    if (match) {
      [, sha256] = match;
    }
    match = def.match(/importpath\s*=\s*"([^"]+)"/);
    if (match) {
      [, importpath] = match;
    }
    logger.debug({ dependency: depName, remote, currentValue });
    if (
      depType === 'git_repository' &&
      depName &&
      remote &&
      (currentValue || commit)
    ) {
      dep.depName = depName;
      if (currentValue) {
        dep.currentValue = currentValue;
      }
      if (commit) {
        dep.currentDigest = commit;
      }
      // TODO: Check if we really need to use parse here or if it should always be a plain https url
      const githubURL = parse(remote);
      if (githubURL) {
        const repo = githubURL.substring('https://github.com/'.length);
        dep.datasource = 'github';
        dep.lookupName = repo;
        deps.push(dep);
      }
    } else if (
      depType === 'go_repository' &&
      depName &&
      importpath &&
      (currentValue || commit)
    ) {
      dep.depName = depName;
      dep.currentValue = currentValue || commit.substr(0, 7);
      dep.datasource = 'go';
      dep.lookupName = importpath;
      if (remote) {
        const remoteMatch = remote.match(
          /https:\/\/github\.com(?:.*\/)(([a-zA-Z]+)([-])?([a-zA-Z]+))/
        );
        if (remoteMatch && remoteMatch[0].length === remote.length) {
          dep.lookupName = remote.replace('https://', '');
        } else {
          dep.skipReason = 'unsupported-remote';
        }
      }
      if (commit) {
        dep.currentValue = 'v0.0.0';
        dep.currentDigest = commit;
        dep.currentDigestShort = commit.substr(0, 7);
        dep.digestOneAndOnly = true;
      }
      deps.push(dep);
    } else if (
      depType === 'http_archive' &&
      depName &&
      parseUrl(url) &&
      sha256
    ) {
      const parsedUrl = parseUrl(url);
      dep.depName = depName;
      dep.repo = parsedUrl.repo;
      if (parsedUrl.currentValue.match(/^[a-f0-9]{40}$/i)) {
        dep.currentDigest = parsedUrl.currentValue;
      } else {
        dep.currentValue = parsedUrl.currentValue;
      }
      dep.datasource = 'github';
      dep.lookupName = dep.repo;
      dep.lookupType = 'releases';
      deps.push(dep);
    } else if (
      depType === 'container_pull' &&
      currentValue &&
      digest &&
      repository &&
      registry
    ) {
      dep.currentDigest = digest;
      dep.currentValue = currentValue;
      dep.depName = depName;
      dep.datasource = 'docker';
      dep.versionScheme = 'docker';
      dep.lookupName = repository;
      deps.push(dep);
    } else {
      logger.info(
        { def },
        'Failed to find dependency in bazel WORKSPACE definition'
      );
    }
  });
  if (!deps.length) {
    return null;
  }
  return { deps };
}
