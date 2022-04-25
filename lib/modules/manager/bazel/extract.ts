/* eslint no-plusplus: 0  */
import { parse as _parse } from 'url';
import parse from 'github-url-from-git';
import moo from 'moo';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { DockerDatasource } from '../../datasource/docker';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GoDatasource } from '../../datasource/go';
import * as dockerVersioning from '../../versioning/docker';
import type { PackageDependency, PackageFile } from '../types';
import type { UrlParsedResult } from './types';

function parseUrl(
  urlString: string | undefined | null
): UrlParsedResult | null {
  // istanbul ignore if
  if (!urlString) {
    return null;
  }
  const url = _parse(urlString);
  if (url.host !== 'github.com' || !url.path) {
    return null;
  }
  const path = url.path.split('/').slice(1);
  const repo = path[0] + '/' + path[1];
  let datasource = '';
  let currentValue: string | null = null;
  if (path[2] === 'releases' && path[3] === 'download') {
    datasource = GithubReleasesDatasource.id;
    currentValue = path[4];
  }
  if (path[2] === 'archive') {
    datasource = GithubTagsDatasource.id;
    currentValue = path[3];
    // Strip archive extension to get hash or tag.
    // Tolerates formats produced by Git(Hub|Lab) and allowed by http_archive
    // Note: Order matters in suffix list to strip, e.g. .tar.gz.
    for (const extension of ['.gz', '.bz2', '.xz', '.tar', '.tgz', '.zip']) {
      if (currentValue.endsWith(extension)) {
        currentValue = currentValue.slice(0, -extension.length);
      }
    }
  }
  if (currentValue) {
    return { datasource, repo, currentValue };
  }
  // istanbul ignore next
  return null;
}

const lexer = moo.states({
  main: {
    lineComment: { match: /#.*?$/ }, // TODO #12870
    leftParen: { match: '(' },
    rightParen: { match: ')' },
    longDoubleQuoted: {
      match: '"""',
      push: 'longDoubleQuoted',
    },
    doubleQuoted: {
      match: '"',
      push: 'doubleQuoted',
    },
    longSingleQuoted: {
      match: "'''",
      push: 'longSingleQuoted',
    },
    singleQuoted: {
      match: "'",
      push: 'singleQuoted',
    },
    def: {
      match: new RegExp(
        [
          'container_pull',
          'http_archive',
          'http_file',
          'go_repository',
          'git_repository',
        ].join('|')
      ),
    },
    unknown: moo.fallback,
  },
  longDoubleQuoted: {
    stringFinish: { match: '"""', pop: 1 },
    char: moo.fallback,
  },
  doubleQuoted: {
    stringFinish: { match: '"', pop: 1 },
    char: moo.fallback,
  },
  longSingleQuoted: {
    stringFinish: { match: "'''", pop: 1 },
    char: moo.fallback,
  },
  singleQuoted: {
    stringFinish: { match: "'", pop: 1 },
    char: moo.fallback,
  },
});

function parseContent(content: string): string[] {
  lexer.reset(content);

  let balance = 0;

  let def: null | string = null;
  const result: string[] = [];

  const finishDef = (): void => {
    if (def !== null) {
      result.push(def);
    }
    def = null;
  };

  const startDef = (): void => {
    finishDef();
    def = '';
  };

  const updateDef = (chunk: string): void => {
    if (def !== null) {
      def += chunk;
    }
  };

  let token = lexer.next();
  while (token) {
    const { type, value } = token;

    if (type === 'def') {
      startDef();
    }

    updateDef(value);

    if (type === 'leftParen') {
      balance += 1;
    }

    if (type === 'rightParen') {
      balance -= 1;
      if (balance <= 0) {
        finishDef();
      }
    }

    token = lexer.next();
  }

  return result;
}

export function extractPackageFile(
  content: string,
  fileName?: string
): PackageFile | null {
  const definitions = parseContent(content);
  if (!definitions.length) {
    logger.debug({ fileName }, 'No matching bazel WORKSPACE definitions found');
    return null;
  }
  logger.debug({ definitions }, `Found ${definitions.length} definitions`);
  const deps: PackageDependency[] = [];
  definitions.forEach((def) => {
    logger.debug({ def }, 'Checking bazel definition');
    const [depType] = def.split('(', 1);
    const dep: PackageDependency = { depType, managerData: { def } };
    let depName: string | undefined;
    let importpath: string | undefined;
    let remote: string | undefined;
    let currentValue: string | undefined;
    let commit: string | undefined;
    let url: string | undefined;
    let sha256: string | undefined;
    let digest: string | undefined;
    let repository: string | undefined;
    let registry: string | undefined;
    let match = regEx(/name\s*=\s*"([^"]+)"/).exec(def);
    if (match) {
      [, depName] = match;
    }
    match = regEx(/digest\s*=\s*"([^"]+)"/).exec(def);
    if (match) {
      [, digest] = match;
    }
    match = regEx(/registry\s*=\s*"([^"]+)"/).exec(def);
    if (match) {
      [, registry] = match;
    }
    match = regEx(/repository\s*=\s*"([^"]+)"/).exec(def);
    if (match) {
      [, repository] = match;
    }
    match = regEx(/remote\s*=\s*"([^"]+)"/).exec(def);
    if (match) {
      [, remote] = match;
    }
    match = regEx(/tag\s*=\s*"([^"]+)"/).exec(def);
    if (match) {
      [, currentValue] = match;
    }
    match = regEx(/url\s*=\s*"([^"]+)"/).exec(def);
    if (match) {
      [, url] = match;
    }
    match = regEx(/urls\s*=\s*\[\s*"([^\]]+)",?\s*\]/).exec(def);
    if (match) {
      const urls = match[1].replace(regEx(/\s/g), '').split('","');
      url = urls.find(parseUrl);
    }
    match = regEx(/commit\s*=\s*"([^"]+)"/).exec(def);
    if (match) {
      [, commit] = match;
    }
    match = regEx(/sha256\s*=\s*"([^"]+)"/).exec(def);
    if (match) {
      [, sha256] = match;
    }
    match = regEx(/importpath\s*=\s*"([^"]+)"/).exec(def);
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
      // TODO: Check if we really need to use parse here or if it should always be a plain https url (#9605)
      const githubURL = parse(remote);
      if (githubURL) {
        const repo = githubURL.substring('https://github.com/'.length);
        dep.datasource = GithubReleasesDatasource.id;
        dep.packageName = repo;
        deps.push(dep);
      }
    } else if (
      depType === 'go_repository' &&
      depName &&
      importpath &&
      (currentValue || commit)
    ) {
      dep.depName = depName;
      dep.currentValue = currentValue || commit?.substring(0, 7);
      dep.datasource = GoDatasource.id;
      dep.packageName = importpath;
      if (remote) {
        const remoteMatch = regEx(
          /https:\/\/github\.com(?:.*\/)(([a-zA-Z]+)([-])?([a-zA-Z]+))/
        ).exec(remote);
        if (remoteMatch && remoteMatch[0].length === remote.length) {
          dep.packageName = remote.replace('https://', '');
        } else {
          dep.skipReason = 'unsupported-remote';
        }
      }
      if (commit) {
        dep.currentValue = 'v0.0.0';
        dep.currentDigest = commit;
        dep.currentDigestShort = commit.substring(0, 7);
        dep.digestOneAndOnly = true;
      }
      deps.push(dep);
    } else if (
      (depType === 'http_archive' || depType === 'http_file') &&
      depName &&
      parseUrl(url) &&
      sha256
    ) {
      const parsedUrl = parseUrl(url);
      // istanbul ignore if: needs test
      if (!parsedUrl) {
        return;
      }
      dep.depName = depName;
      dep.repo = parsedUrl.repo;
      if (regEx(/^[a-f0-9]{40}$/i).test(parsedUrl.currentValue)) {
        dep.currentDigest = parsedUrl.currentValue;
      } else {
        dep.currentValue = parsedUrl.currentValue;
      }
      dep.datasource = parsedUrl.datasource;
      dep.packageName = dep.repo;
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
      dep.versioning = dockerVersioning.id;
      dep.datasource = DockerDatasource.id;
      dep.packageName = repository;
      dep.registryUrls = [registry];
      deps.push(dep);
    } else {
      logger.debug(
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
