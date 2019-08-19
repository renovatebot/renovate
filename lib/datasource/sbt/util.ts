export const SBT_PLUGINS_REPO =
  'https://dl.bintray.com/sbt/sbt-plugin-releases';

export function parseIndexDir(
  content: string,
  filterFn = (x: string) => !/^\.+/.test(x)
) {
  const unfiltered = content.match(/(?<=href=['"])[^'"]*(?=\/['"])/g) || [];
  return unfiltered.filter(filterFn);
}
