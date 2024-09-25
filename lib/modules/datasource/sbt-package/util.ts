import { coerceArray } from '../../../util/array';
import { filterMap } from '../../../util/filter-map';
import { compare } from '../../versioning/maven/compare';

const linkRegExp = /(?<=href=['"])[^'"]*(?=\/['"])/gi;

export function extractPageLinks(
  content: string,
  filterMapFn: (href: string) => string | null,
): string[] {
  const unfiltered = coerceArray(content.match(linkRegExp));
  return filterMap(unfiltered, filterMapFn);
}

export function getLatestVersion(versions: string[] | null): string | null {
  if (versions?.length) {
    return versions.reduce((latestVersion, version) =>
      compare(version, latestVersion) === 1 ? version : latestVersion,
    );
  }
  return null;
}
