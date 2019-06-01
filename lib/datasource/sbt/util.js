const SBT_PLUGINS_REPO = 'https://dl.bintray.com/sbt/sbt-plugin-releases';

function parseIndexDir(content, filterFn = x => !/^\.+/.test(x)) {
  const unfiltered = content.match(/(?<=href=['"])[^'"]*(?=\/['"])/g) || [];
  return unfiltered.filter(filterFn);
}

module.exports = {
  parseIndexDir,
  SBT_PLUGINS_REPO,
};
