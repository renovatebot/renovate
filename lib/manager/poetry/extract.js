const toml = require('toml');
const semver = require('../../versioning/poetry');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content, fileName) {
  logger.trace(`poetry.extractPackageFile(${fileName})`);
  let pyprojectfile;
  try {
    pyprojectfile = toml.parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing pyproject.toml file');
    return null;
  }
  const dependencies = pyprojectfile.tool.poetry.dependencies;
  const devDeps = pyprojectfile.tool.poetry['dev-dependencies'];
  const extras = pyprojectfile.tool.poetry.extras;
  const allDeps = { ...dependencies, ...devDeps, ...extras };
  const deps = [];
  let skipReason;
  Object.keys(allDeps).forEach(depName => {
    let currentValue = allDeps[depName];
    if (typeof currentValue !== 'string') {
      const version = allDeps[depName].version;
      const path = allDeps[depName].path;
      if (version) {
        currentValue = version;
      } else if (path) {
        currentValue = '';
        skipReason = 'path-dependency';
      } else {
        currentValue = '';
        skipReason = 'multiple-constraint-dep';
      }
    }
    const dep = {
      depName,
      currentValue,
      datasource: 'pypi',
    };
    if (skipReason) {
      dep.skipReason = skipReason;
    } else if (!semver.isValid(dep.currentValue)) {
      dep.skipReason = 'unknown-version';
    }
    deps.push(dep);
  });
  return { deps };
}
