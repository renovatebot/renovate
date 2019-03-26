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
  const allDeps = Object.assign(dependencies, devDeps, extras);
  const deps = [];
  Object.keys(allDeps).forEach(depName => {
    const dep = {
      depName,
      currentValue: allDeps[depName],
      datasource: 'pypi',
    };
    if (!semver.isValid(dep.currentValue)) {
      dep.skipReason = 'unknown-version';
    }
    deps.push(dep);
  });
  return { deps };
}
