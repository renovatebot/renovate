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
  const deps = [
    ...extractFromSection(pyprojectfile, 'dependencies'),
    ...extractFromSection(pyprojectfile, 'dev-dependencies'),
    ...extractFromSection(pyprojectfile, 'extras'),
  ];
  return { deps };
}

function extractFromSection(parsedFile, section) {
  const deps = [];
  const sectionContent = parsedFile.tool.poetry[section];
  if (!sectionContent) {
    return [];
  }
  Object.keys(sectionContent).forEach(depName => {
    let skipReason;
    let currentValue = sectionContent[depName];
    let nestedVersion = false;
    if (typeof currentValue !== 'string') {
      const version = sectionContent[depName].version;
      const path = sectionContent[depName].path;
      if (version) {
        currentValue = version;
        nestedVersion = true;
        if (path) {
          skipReason = 'path-dependency';
        }
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
      depType: section,
      currentValue,
      nestedVersion,
      datasource: 'pypi',
    };
    if (skipReason) {
      dep.skipReason = skipReason;
    } else if (!semver.isValid(dep.currentValue)) {
      dep.skipReason = 'unknown-version';
    }
    deps.push(dep);
  });
  return deps;
}
