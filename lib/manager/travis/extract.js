const yaml = require('js-yaml');

module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  const doc = yaml.safeLoad(content);
  let deps = [];
  if (doc && Array.isArray(doc.node_js)) {
    deps = [
      {
        depName: 'node',
        currentValue: doc.node_js,
        versionScheme: 'semver',
      },
    ];
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
