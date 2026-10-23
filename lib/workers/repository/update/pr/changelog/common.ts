import { isDate } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import _slugify from 'slugify';
import { regEx } from '../../../../../util/regex.ts';

const slugify = _slugify;

/**
 * Age in hours below which a release counts as fresh.
 */
const freshReleaseHours = 1;

/**
 * Whether the release was published less than `freshReleaseHours` ago.
 */
export function isFreshRelease(releaseDate?: string | Date | null): boolean {
  if (!releaseDate) {
    return false;
  }
  const dt = isDate(releaseDate)
    ? DateTime.fromJSDate(releaseDate)
    : DateTime.fromISO(releaseDate);
  if (!dt.isValid) {
    return false;
  }
  return DateTime.now().diff(dt, 'hours').hours < freshReleaseHours;
}

export function slugifyUrl(url: string): string {
  const r = regEx(/[:/.]+/g);
  return slugify(url.replace(r, ' '));
}

/**
 * A comparator function to sort changelog files by preference,
 * prioritizing markdown files and plain text files over other file types.
 *
 * Avoid selecting files like `CHANGELOG.json` when `CHANGELOG.md` is available.
 * @see https://github.com/renovatebot/renovate/issues/25830
 *
 * @example
 * ```
 * const changelogFiles = [
 * 'CHANGELOG.json',
 * 'CHANGELOG',
 * 'CHANGELOG.md',
 * ].sort(compareChangelogFilePath);
 *
 * console.log(changelogFiles); // =>
 * [
 *  'CHANGELOG.md',
 *  'CHANGELOG',
 *  'CHANGELOG.json',
 * ]
 * ```
 *
 * @param a path to changelog file
 * @param b path to changelog file
 */
export function compareChangelogFilePath(a: string, b: string): number {
  const preferedChangelogRegexList = [
    regEx(/\.(?:md|markdown|mkd)$/i),
    regEx(/\.(?:txt|text)$/i),
  ];

  const aPreferedIndex = preferedChangelogRegexList.findIndex((f) => f.test(a));
  const bPreferedIndex = preferedChangelogRegexList.findIndex((f) => f.test(b));
  if (aPreferedIndex === bPreferedIndex) {
    return a.localeCompare(b);
  }
  if (aPreferedIndex >= 0 && bPreferedIndex >= 0) {
    return aPreferedIndex - bPreferedIndex;
  }
  return aPreferedIndex >= 0 ? -1 : 1;
}
