const pluginRegex = /(^|\n)\s*plugins\s+{\s*\n((.*\n)*?)\s*}/;

function parseBuildGradle(content) {
  const res = [];
  const pluginContent = content.match(pluginRegex);
  if (!pluginContent) {
    logger.debug('No plugins found');
    return res;
  }
  const pluginLines = pluginContent[2]
    .split('\n')
    .map(line =>
      line.includes('//') ? line.substring(0, line.indexOf('//')) : line
    )
    .map(line => line.trim())
    .filter(line => line.length);
  for (const line of pluginLines) {
    const plugin = {};
    const idRegex = /id\s+('|")(.*?)('|")/;
    const idMatch = line.match(idRegex);
    if (idMatch) {
      plugin.name = idMatch[2];
      plugin.depName = `Gradle Plugin ${plugin.depName}`;
      const versionRegex = /version\s+('|")(.*?)('|")/;
      const versionMatch = line.match(versionRegex);
      if (versionMatch) {
        plugin.currentValue = versionMatch[2];
      }
      res.push(plugin);
    }
  }
  return res;
}

module.exports = {
  parseBuildGradle,
};
