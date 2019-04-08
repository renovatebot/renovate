const toml = require('toml');
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
  const target = parsedContent.target;
  // An array of all dependencies in the target section
  let targetDeps = [];
  if (target) {
    const platforms = Object.keys(target);
    platforms.forEach(platform => {
      const platformContent = parsedContent.target[platform];
      // Dependencies for `${platform}`
      const deps = [
        ...extractFromSection(platformContent, 'dependencies', platform),
        ...extractFromSection(platformContent, 'dev-dependencies', platform),
        ...extractFromSection(platformContent, 'build-dependencies', platform),
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

function extractFromSection(parsedContent, section, platform) {
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
      purl: 'pkg:cargo/' + depName,
    };
    if (skipReason) {
      dep.skipReason = skipReason;
    } else if (!semver.isValid(dep.currentValue)) {
      dep.skipReason = 'unknown-version';
    }
    if (platform) {
      dep.platform = platform;
    }
    deps.push(dep);
  });
  return deps;
}
