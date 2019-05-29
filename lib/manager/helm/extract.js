const yaml = require('js-yaml');
const is = require('@sindresorhus/is');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  logger.trace('helm.extractPackageFile()');
  let deps = [];
  try {
    const doc = yaml.safeLoad(content);
    if (doc && is.array(doc.dependencies)) {
      deps = doc.dependencies.map(dep => ({
        depName: dep.name,
        currentValue: dep.version,
        repository: dep.repository,
      }));
    }
  } catch (err) {
    logger.error('extractPackageFile failed to parse requirements.yaml file');
  }
  if (deps.length === 0) {
    logger.debug("extractPackageFile didn't extract any dependencies");
    return null;
  }
  return { deps };
}
