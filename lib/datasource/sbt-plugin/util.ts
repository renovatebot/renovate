import url from 'url';
import { regEx } from '../../util/regex';

const linkRegExp = /(?<=href=['"])[^'"]*(?=\/['"])/g;

export const SBT_PLUGINS_REPO =
  'https://dl.bintray.com/sbt/sbt-plugin-releases';

export function parseIndexDir(
  content: string,
  filterFn = (x: string): boolean => !regEx(/^\.+/).test(x)
): string[] {
  const unfiltered = content.match(linkRegExp) || [];
  return unfiltered.filter(filterFn);
}

export function normalizeRootRelativeUrls(
  content: string,
  rootUrl: string | url.URL
): string {
  const rootRelativePath = new url.URL(rootUrl.toString()).pathname;
  return content.replaceAll(linkRegExp, (href) =>
    href.replace(rootRelativePath, '')
  );
}
