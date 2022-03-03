import URL from 'url';
import is from '@sindresorhus/is';
import parse from 'github-url-from-git';
import { DateTime } from 'luxon';
import * as hostRules from '../../util/host-rules';
import { regEx } from '../../util/regex';
import { validateUrl } from '../../util/url';
import { manualChangelogUrls, manualSourceUrls } from './metadata-manual';
import type { ReleaseResult } from './types';

const githubPages = regEx('^https://([^.]+).github.com/([^/]+)$');
const gitPrefix = regEx('^git:/?/?');

export function massageGithubUrl(url: string): string {
  let massagedUrl = url;

  if (url.startsWith('git@')) {
    massagedUrl = url.replace(':', '/').replace('git@', 'https://');
  }

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
  return url
    .replace('http:', 'https:')
    .replace(regEx(/^git:\/?\/?/), 'https://')
    .replace(regEx(/\/tree\/.*$/i), '')
    .replace(regEx(/\/$/i), '')
    .replace('.git', '');
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
  lookupName: string
): void {
  massageTimestamps(dep);

  const lookupNameLowercase = lookupName.toLowerCase();
  const manualChangelogUrl =
    manualChangelogUrls[datasource]?.[lookupNameLowercase];
  if (manualChangelogUrl) {
    dep.changelogUrl = manualChangelogUrl;
  }

  const manualSourceUrl = manualSourceUrls[datasource]?.[lookupNameLowercase];
  if (manualSourceUrl) {
    dep.sourceUrl = manualSourceUrl;
  }

  if (
    dep.changelogUrl?.includes('github.com') && // lgtm [js/incomplete-url-substring-sanitization]
    !dep.sourceUrl
  ) {
    dep.sourceUrl = dep.changelogUrl;
  }
  // prettier-ignore
  if (dep.homepage?.includes('github.com')) { // lgtm [js/incomplete-url-substring-sanitization]
    if (!dep.sourceUrl) {
      dep.sourceUrl = dep.homepage;
    }
    delete dep.homepage;
  }
  const extraBaseUrls = [];
  // istanbul ignore next
  hostRules.hosts({ hostType: 'github' }).forEach((host) => {
    extraBaseUrls.push(host, `gist.${host}`);
  });
  extraBaseUrls.push('gitlab.com');
  if (dep.sourceUrl) {
    const parsedUrl = URL.parse(dep.sourceUrl);
    if (parsedUrl?.hostname) {
      let massagedUrl;
      if (parsedUrl.hostname.includes('gitlab')) {
        massagedUrl = massageGitlabUrl(dep.sourceUrl);
      } else {
        massagedUrl = massageGithubUrl(dep.sourceUrl);
      }
      // try massaging it
      dep.sourceUrl =
        parse(massagedUrl, {
          extraBaseUrls,
        }) || dep.sourceUrl;
    } else {
      delete dep.sourceUrl;
    }
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
