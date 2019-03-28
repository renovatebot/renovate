const toml = require('toml');
const semver = require('../../versioning/poetry');

module.exports = {
  extractPackageFile,
};

// TODO: Implement dep = { version = "..." } style dependencies
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
  Object.keys(allDeps).forEach(depName => {
    let currentValue = allDeps[depName];
    if (typeof currentValue !== 'string') {
      const version = allDeps[depName].version;
      if (version) {
        currentValue = version;
      }
    }
    const dep = {
      depName,
      currentValue,
      datasource: 'pypi',
    };
    if (!dep.skipReason && !semver.isValid(dep.currentValue)) {
      dep.skipReason = 'unknown-version';
    }
    if (allDeps[depName].path) {
      dep.skipReason = 'path-dependency';
    }
    deps.push(dep);
  });
  return { deps };
}
