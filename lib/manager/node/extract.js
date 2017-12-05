const yaml = require('js-yaml');

module.exports = {
  extractDependencies,
};

function extractDependencies(packageContent) {
  const doc = yaml.safeLoad(packageContent);
  if (doc && Array.isArray(doc.node_js)) {
    return [{ depName: 'Travis node_js', currentVersions: doc.node_js }];
  }
  return [];
}
