import is from '@sindresorhus/is';
import parse from 'github-url-from-git';
import { DateTime } from 'luxon';
import { detectPlatform } from '../../util/common';
import { parseGitUrl } from '../../util/git/url';
import * as hostRules from '../../util/host-rules';
import { regEx } from '../../util/regex';
import { parseUrl, trimTrailingSlash, validateUrl } from '../../util/url';
import { manualChangelogUrls, manualSourceUrls } from './metadata-manual';
import type { ReleaseResult } from './types';

const githubPages = regEx('^https://([^.]+).github.com/([^/]+)$');
const gitPrefix = regEx('^git:/?/?');

export function massageUrl(sourceUrl: string): string {
  // Replace git@ sourceUrl with https so hostname can be parsed
  const massagedUrl = massageGitAtUrl(sourceUrl);

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
  const massagedUrl = massageGitAtUrl(url);

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

function massageGitlabUrl(url: string): string {
  const massagedUrl = massageGitAtUrl(url);

  return massagedUrl
    .replace('http:', 'https:')
    .replace(gitPrefix, 'https://')
    .replace(regEx(/\/tree\/.*$/i), '')
    .replace(regEx(/\/$/i), '')
    .replace('.git', '');
}

function massageGitAtUrl(url: string): string {
  let massagedUrl = url;

  if (url.startsWith('git@')) {
    massagedUrl = url.replace(':', '/').replace('git@', 'https://');
  }
  return massagedUrl;
}

export function normalizeDate(input: any): string | null {
  if (
    typeof input === 'number' &&
    !Number.isNaN(input) &&
    input > 0 &&
    input <= Date.now() + 24 * 60 * 60 * 1000
  ) {
    return new Date(input).toISOString();
  }

  if (typeof input === 'string') {
    // `Date.parse()` is more permissive, but it assumes local time zone
    // for inputs like `2021-01-01`.
    //
    // Here we try to parse with default UTC with fallback to `Date.parse()`.
    //
    // It allows us not to care about machine timezones so much, though
    // some misinterpretation is still possible, but only if both:
    //
    //   1. Renovate machine is configured for non-UTC zone
    //   2. Format of `input` is very exotic
    //      (from `DateTime.fromISO()` perspective)
    //
    const luxonDate = DateTime.fromISO(input, { zone: 'UTC' });
    if (luxonDate.isValid) {
      return luxonDate.toISO();
    }

    return normalizeDate(Date.parse(input));
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  return null;
}

function massageTimestamps(dep: ReleaseResult): void {
  for (const release of dep.releases || []) {
    let { releaseTimestamp } = release;
    delete release.releaseTimestamp;
    releaseTimestamp = normalizeDate(releaseTimestamp);
    if (releaseTimestamp) {
      release.releaseTimestamp = releaseTimestamp;
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
    } catch (err) {
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
    const massagedUrl = massageUrl(dep.sourceUrl);
    if (is.emptyString(massagedUrl)) {
      delete dep.sourceUrl;
    } else {
      // try massaging it
      dep.sourceUrl =
        parse(massagedUrl, {
          extraBaseUrls,
        }) || dep.sourceUrl;
    }
  }
  if (shouldDeleteHomepage(dep.sourceUrl, dep.homepage)) {
    delete dep.homepage;
  }
  // Clean up any empty urls
  const urlKeys: (keyof ReleaseResult)[] = [
    'homepage',
    'sourceUrl',
    'changelogUrl',
    'dependencyUrl',
  ];
  for (const urlKey of urlKeys) {
    const urlVal = dep[urlKey];
    if (is.string(urlVal) && validateUrl(urlVal.trim())) {
      dep[urlKey] = urlVal.trim() as never;
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
  if (is.nullOrUndefined(sourceUrl) || is.undefined(homepage)) {
    return false;
  }
  const massagedSourceUrl = massageUrl(sourceUrl);
  const platform = detectPlatform(homepage);
  if (platform === 'github' || platform === 'gitlab') {
    const sourceUrlParsed = parseUrl(massagedSourceUrl);
    if (is.nullOrUndefined(sourceUrlParsed)) {
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
