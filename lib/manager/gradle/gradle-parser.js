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
      if (!isCorePlugin(idMatch)) {
        plugin.group = idMatch[2];
        plugin.name = `${plugin.group}.gradle.plugin`;
        plugin.depName = `Gradle Plugin ${plugin.group}`;
        plugin.registryUrls = ['https://plugins.gradle.org/m2/'];
        const versionRegex = /version\s+('|")(.*?)('|")/;
        const versionMatch = line.match(versionRegex);
        if (versionMatch) {
          plugin.currentValue = versionMatch[2];
        }
        res.push(plugin);
      }
    }
  }
  return res;
}

function isCorePlugin(match) {
  const CORE_PLUGINS = [
    'java',
    'java-library',
    'java-platform',
    'groovy',
    'scala',
    'play',
    'antl',
    'cpp-application',
    'cpp-library',
    'cpp-unit-test',
    'application',
    'war',
    'ear',
    'osgi',
    'maven-publish',
    'ivy-publish',
    'maven',
    'distribution',
    'java-library-distribution',
    'checkstyle',
    'findbugs',
    'pmd',
    'jdepend',
    'jacoco',
    'codenarc',
    'eclipse',
    'eclipse-wtp',
    'idea',
    'base',
    'signing',
    'java-gradle-plugin'
  ];

  return CORE_PLUGINS.includes(match[2]);
}

module.exports = {
  parseBuildGradle,
};
