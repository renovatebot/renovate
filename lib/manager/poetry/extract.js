const toml = require('toml');
const semver = require('../../versioning/poetry');
const { logger } = require('../../logger');

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
  if (!(pyprojectfile.tool && pyprojectfile.tool.poetry)) {
    logger.debug(`${fileName} contains no poetry section`);
    return null;
  }
  const deps = [
    ...extractFromSection(pyprojectfile, 'dependencies'),
    ...extractFromSection(pyprojectfile, 'dev-dependencies'),
    ...extractFromSection(pyprojectfile, 'extras'),
  ];
  if (!deps.length) {
    return null;
  }
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
      const git = sectionContent[depName].git;
      if (version) {
        currentValue = version;
        nestedVersion = true;
        if (path) {
          skipReason = 'path-dependency';
        }
        if (git) {
          skipReason = 'git-dependency';
        }
      } else if (path) {
        currentValue = '';
        skipReason = 'path-dependency';
      } else if (git) {
        currentValue = '';
        skipReason = 'git-dependency';
      } else {
        currentValue = '';
        skipReason = 'multiple-constraint-dep';
      }
    }
    const dep = {
      depName,
      depType: section,
      currentValue,
      managerData: { nestedVersion },
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
