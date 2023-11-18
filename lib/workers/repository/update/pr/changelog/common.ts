import slugify from 'slugify';
import { regEx } from '../../../../../util/regex';

export function slugifyUrl(url: string): string {
  const r = regEx(/[:/.]+/g);
  return slugify(url.replace(r, ' '));
}

/**
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
    /\.(?:md|markdown|mkd)$/i,
    /\.(?:txt|text)$/i,
  ];

  const aPreferedIndex = preferedChangelogRegexList.findIndex((f) => f.test(a));
  const bPreferedIndex = preferedChangelogRegexList.findIndex((f) => f.test(b));
  if (aPreferedIndex === bPreferedIndex) {
    return a.localeCompare(b);
  } else if (aPreferedIndex >= 0 && bPreferedIndex >= 0) {
    return aPreferedIndex - bPreferedIndex;
  }
  return aPreferedIndex >= 0 ? -1 : 1;
}
