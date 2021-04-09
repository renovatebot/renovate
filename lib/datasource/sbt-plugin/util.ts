export const SBT_PLUGINS_REPO =
  'https://dl.bintray.com/sbt/sbt-plugin-releases';

export function parseIndexDir(
  content: string,
  filterFn = (x: string): boolean => !/^\.+/.test(x)
): string[] {
  const unfiltered = content.match(/(?<=href=['"])[^'"]*(?=\/['"])/g) || [];
  return unfiltered.filter(filterFn);
}
