import { coerceArray } from '../../../util/array';
import { regEx } from '../../../util/regex';
import { compare } from '../../versioning/maven/compare';

const linkRegExp = /(?<=href=['"])[^'"]*(?=\/['"])/gi;

export function parseIndexDir(
  content: string,
  filterFn = (x: string): boolean => !regEx(/^\.+/).test(x),
): string[] {
  const unfiltered = coerceArray(content.match(linkRegExp));
  return unfiltered.filter(filterFn);
}

export function normalizeRootRelativeUrls(
  content: string,
  rootUrl: string | URL,
): string {
  const rootRelativePath = new URL(rootUrl.toString()).pathname;
  return content.replace(linkRegExp, (href: string) =>
    href.replace(rootRelativePath, ''),
  );
}

export function getLatestVersion(versions: string[] | null): string | null {
  if (versions?.length) {
    return versions.reduce((latestVersion, version) =>
      compare(version, latestVersion) === 1 ? version : latestVersion,
    );
  }
  return null;
}
