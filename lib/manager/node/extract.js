const yaml = require('js-yaml');

module.exports = {
  extractDependencies,
};

function extractDependencies(packageContent) {
  try {
    const doc = yaml.safeLoad(packageContent);
    if (Array.isArray(doc.node_js)) {
      return [{ depName: 'Travis node_js', currentVersions: doc.node_js }];
    }
  } catch (err) {
    logger.warn({ packageContent }, 'Failed to parse .travis.yml');
  }
  return [];
}
