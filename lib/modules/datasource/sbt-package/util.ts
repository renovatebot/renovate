import { coerceArray } from '../../../util/array.ts';
import { filterMap } from '../../../util/filter-map.ts';
import { compare } from '../../versioning/maven/compare.ts';

const linkRegExp = /(?<=href=['"])[^'"]*(?=\/['"])/gi;

export function extractPageLinks(
  html: string,
  filterMapHref: (href: string) => string | null | undefined,
): string[] {
  const unfiltered = coerceArray(html.match(linkRegExp));
  return filterMap(unfiltered, filterMapHref);
}

export function getLatestVersion(versions: string[] | null): string | null {
  if (versions?.length) {
    return versions.reduce((latestVersion, version) =>
      compare(version, latestVersion) === 1 ? version : latestVersion,
    );
  }
  return null;
}
