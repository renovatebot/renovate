const yaml = require('js-yaml');

module.exports = {
  extractDependencies,
};

function extractDependencies(fileName, content) {
  const doc = yaml.safeLoad(content);
  let deps = [];
  if (doc && Array.isArray(doc.node_js)) {
    deps = [
      {
        depName: 'node',
        currentVersion: doc.node_js,
      },
    ];
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
