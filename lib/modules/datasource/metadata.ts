import {
  isEmptyString,
  isNullOrUndefined,
  isString,
  isUndefined,
} from '@sindresorhus/is';
import parse from 'github-url-from-git';
import { detectPlatform } from '../../util/common.ts';
import { parseGitUrl } from '../../util/git/url.ts';
import * as hostRules from '../../util/host-rules.ts';
import { regEx } from '../../util/regex.ts';
import { asTimestamp } from '../../util/timestamp.ts';
import {
  isHttpUrl,
  parseUrl,
  trimTrailingSlash,
  withoutUrlCredentials,
} from '../../util/url.ts';
import { manualChangelogUrls, manualSourceUrls } from './metadata-manual.ts';
import type { Release, ReleaseResult } from './types.ts';

const githubPages = regEx('^https://([^.]+).github.com/([^/]+)$');
const gitPlusPrefix = regEx('^git\\+');
const gitPrefix = regEx('^git:/?/?');

export function massageUrl(sourceUrl: string): string {
  // Replace git@ sourceUrl with https so hostname can be parsed
  const massagedUrl = massageGitPrefixes(sourceUrl);

  // Check if URL is valid
  const parsedUrl = parseUrl(massagedUrl);
  if (!parsedUrl) {
    return '';
  }

  if (detectPlatform(massagedUrl) === 'gitlab') {
    return massageGitlabUrl(sourceUrl);
  }
  return massageGithubUrl(sourceUrl);
}

export function massageGithubUrl(url: string): string {
  const massagedUrl = massageGitPrefixes(url);

  return massagedUrl
    .replace('http:', 'https:')
    .replace('http+git:', 'https:')
    .replace('https+git:', 'https:')
    .replace('ssh://git@', 'https://')
    .replace(gitPrefix, 'https://')
    .replace(githubPages, 'https://github.com/$1/$2')
    .replace('www.github.com', 'github.com')
    .split('/')
    .slice(0, 5)
    .join('/');
}

export function massageGitlabUrl(url: string): string {
  const massagedUrl = massageGitPrefixes(url);

  return massagedUrl
    .replace('http:', 'https:')
    .replace('ssh://git@', 'https://')
    .replace(gitPrefix, 'https://')
    .replace(regEx(/\/tree\/.*$/i), '')
    .replace(regEx(/\/$/i), '')
    .replace(regEx(/\.git$/i), '');
}

function massageGitPrefixes(url: string): string {
  let massagedUrl = url.replace(gitPlusPrefix, '');

  if (massagedUrl.startsWith('git@')) {
    massagedUrl = massagedUrl.replace(':', '/').replace('git@', 'https://');
  }

  return massagedUrl;
}

function massageTimestamps(dep: ReleaseResult): void {
  for (const release of dep.releases || []) {
    let { releaseTimestamp } = release;
    delete release.releaseTimestamp;
    releaseTimestamp = asTimestamp(releaseTimestamp);
    if (releaseTimestamp) {
      release.releaseTimestamp = releaseTimestamp;
    }
  }
}

/**
 * The URLs of a {@link ReleaseResult} describing the package.
 */
const metadataUrlKeys = [
  'homepage',
  'sourceUrl',
  'changelogUrl',
  'dependencyUrl',
] as const satisfies (keyof ReleaseResult)[];

/**
 * The URLs of a {@link Release}.
 */
const releaseUrlKeys = [
  'changelogUrl',
  'checksumUrl',
  'downloadUrl',
  'registryUrl',
  'sourceUrl',
] as const satisfies (keyof Release)[];

/**
 * Removes the URL credentials from the package URLs of `dep` and from the URLs of its releases.
 */
export function stripMetadataUrlCredentials(dep: ReleaseResult): void {
  for (const urlKey of metadataUrlKeys) {
    const urlVal = dep[urlKey];
    if (isString(urlVal)) {
      dep[urlKey] = withoutUrlCredentials(urlVal);
    }
  }
  for (const release of dep.releases) {
    for (const urlKey of releaseUrlKeys) {
      const urlVal = release[urlKey];
      if (isString(urlVal)) {
        release[urlKey] = withoutUrlCredentials(urlVal);
      }
    }
  }
}

export function addMetaData(
  dep: ReleaseResult,
  datasource: string,
  packageName: string,
): void {
  massageTimestamps(dep);

  const packageNameLowercase = packageName.toLowerCase();
  const manualChangelogUrl =
    manualChangelogUrls[datasource]?.[packageNameLowercase];
  if (manualChangelogUrl) {
    dep.changelogUrl = manualChangelogUrl;
  }

  const manualSourceUrl = manualSourceUrls[datasource]?.[packageNameLowercase];
  if (manualSourceUrl) {
    dep.sourceUrl = manualSourceUrl;
  }

  if (dep.sourceUrl && !dep.sourceDirectory) {
    try {
      const parsed = parseGitUrl(dep.sourceUrl);
      if (parsed.filepathtype === 'tree' && parsed.filepath !== '') {
        dep.sourceUrl = parsed.toString();
        dep.sourceDirectory = parsed.filepath;
      }
    } catch {
      // ignore invalid urls
    }
  }

  if (
    !dep.sourceUrl &&
    dep.changelogUrl &&
    detectPlatform(dep.changelogUrl) === 'github'
  ) {
    dep.sourceUrl = dep.changelogUrl;
  }

  if (!dep.sourceUrl && dep.homepage) {
    const platform = detectPlatform(dep.homepage);
    if (platform === 'github' || platform === 'gitlab') {
      dep.sourceUrl = dep.homepage;
    }
  }
  const extraBaseUrls = [];
  // istanbul ignore next
  hostRules.hosts({ hostType: 'github' }).forEach((host) => {
    extraBaseUrls.push(host, `gist.${host}`);
  });
  extraBaseUrls.push('gitlab.com');
  if (dep.sourceUrl) {
    // try massaging it
    const massagedUrl = massageUrl(dep.sourceUrl);
    if (isEmptyString(massagedUrl)) {
      delete dep.sourceUrl;
    } else {
      // parse from github-url-from-git only supports Github URLs as its name implies
      dep.sourceUrl =
        parse(massagedUrl, {
          extraBaseUrls,
        }) || dep.sourceUrl;
      // prefer massaged URL to source URL if the latter does not start with http:// or https://
      // (e.g. git@somehost.com) and the detected platform is gitlab.
      // this allows to retrieve changelogs from git hosts other than Github
      if (
        !isHttpUrl(dep.sourceUrl) &&
        detectPlatform(massagedUrl) === 'gitlab'
      ) {
        dep.sourceUrl = massagedUrl;
      }
    }
  }
  if (shouldDeleteHomepage(dep.sourceUrl, dep.homepage)) {
    delete dep.homepage;
  }
  // Clean up any empty urls
  for (const urlKey of metadataUrlKeys) {
    const urlVal = dep[urlKey];
    if (isString(urlVal) && isHttpUrl(urlVal.trim())) {
      // Strip any userinfo credentials so they do not end up in a PR body, also from URLs added or massaged above
      dep[urlKey] = withoutUrlCredentials(urlVal.trim()) as never;
    } else {
      delete dep[urlKey];
    }
  }
}

/**
 * Returns true if
 * 1. it's a github or gitlab url and not a path within the repo.
 * 2. it's equal to sourceURl
 * @param sourceUrl
 * @param homepage
 */
export function shouldDeleteHomepage(
  sourceUrl: string | null | undefined,
  homepage: string | undefined,
): boolean {
  if (isNullOrUndefined(sourceUrl) || isUndefined(homepage)) {
    return false;
  }
  const massagedSourceUrl = massageUrl(sourceUrl);
  const platform = detectPlatform(homepage);
  if (platform === 'github' || platform === 'gitlab') {
    const sourceUrlParsed = parseUrl(massagedSourceUrl);
    if (isNullOrUndefined(sourceUrlParsed)) {
      return false;
    }
    const homepageParsed = parseUrl(homepage);
    return (
      homepageParsed !== null &&
      trimTrailingSlash(homepageParsed.pathname) ===
        trimTrailingSlash(sourceUrlParsed.pathname)
    );
  }
  return massagedSourceUrl === homepage;
}
