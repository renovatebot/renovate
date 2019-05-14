const pluginRegex = /(^|\n)plugins\s+{\s*\n((.*\n)*?)}/;

function parseBuildGradleKts(content) {
  const res = {};
  const pluginContent = content.match(pluginRegex);
  if (!pluginContent) {
    logger.debug('No plugins found');
    return res;
  }
  res.plugins = [];
  const pluginLines = pluginContent[2]
    .split('\n')
    .map(line =>
      line.includes('//') ? line.substring(0, line.indexOf('//')) : line
    )
    .map(line => line.trim())
    .filter(line => line.length);
  for (const line of pluginLines) {
    const plugin = {};
    const idRegex = /id\("(.*?)"/;
    const idMatch = line.match(idRegex);
    if (idMatch) {
      plugin.id = idMatch[1];
      const versionRegex = /version\s+"(.*?)"/;
      const versionMatch = line.match(versionRegex);
      if (versionMatch) {
        plugin.version = versionMatch[1];
      }
      res.plugins.push(plugin);
    }
  }
  return res;
}

module.exports = {
  pluginRegex,
  parseBuildGradleKts,
};
