const { parseBuildGradle } = require('./parse');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  let deps = [];
  const parsed = parseBuildGradle(content);
  logger.debug({ parsed });
  if (parsed.plugins) {
    deps = parsed.plugins.map(plugin => {
      const dep = {
        depType: 'plugin',
        depName: plugin.id,
      };
      if (plugin.version) {
        dep.datasource = 'maven';
        dep.registryUrls = ['https://plugins.gradle.org/m2/'];
        dep.lookupName = `${plugin.id}:${plugin.id}.gradle.plugin`;
        dep.currentValue = plugin.version;
        dep.commitMessageTopic = `plugin ${plugin.id}`;
      } else {
        dep.skipReason = 'no-version';
      }
      return dep;
    });
  }
  logger.debug({ deps });
  if (!deps.length) {
    return null;
  }
  return { deps };
}
