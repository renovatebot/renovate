const toml = require('toml');
const { logger } = require('../../logger');
const semver = require('../../versioning/cargo');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content, fileName) {
  logger.trace(`cargo.extractPackageFile(${fileName})`);
  let parsedContent;
  try {
    parsedContent = toml.parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing Cargo.toml file');
    return null;
  }
  /*
    There are the following sections in Cargo.toml:
    [dependencies]
    [dev-dependencies]
    [build-dependencies]
    [target.*.dependencies]
  */
  const targetSection = parsedContent.target;
  // An array of all dependencies in the target section
  let targetDeps = [];
  if (targetSection) {
    const targets = Object.keys(targetSection);
    targets.forEach(target => {
      const targetContent = parsedContent.target[target];
      // Dependencies for `${target}`
      const deps = [
        ...extractFromSection(targetContent, 'dependencies', target),
        ...extractFromSection(targetContent, 'dev-dependencies', target),
        ...extractFromSection(targetContent, 'build-dependencies', target),
      ];
      targetDeps = targetDeps.concat(deps);
    });
  }
  const deps = [
    ...extractFromSection(parsedContent, 'dependencies'),
    ...extractFromSection(parsedContent, 'dev-dependencies'),
    ...extractFromSection(parsedContent, 'build-dependencies'),
    ...targetDeps,
  ];
  if (!deps.length) {
    return null;
  }
  return { deps };
}

function extractFromSection(parsedContent, section, target) {
  const deps = [];
  const sectionContent = parsedContent[section];
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
        skipReason = 'invalid-dependency-specification';
      }
    }
    const dep = {
      depName,
      depType: section,
      currentValue,
      nestedVersion,
      datasource: 'cargo',
    };
    if (skipReason) {
      dep.skipReason = skipReason;
    } else if (!semver.isValid(dep.currentValue)) {
      dep.skipReason = 'unknown-version';
    }
    if (target) {
      dep.target = target;
    }
    deps.push(dep);
  });
  return deps;
}
