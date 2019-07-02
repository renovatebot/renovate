const is = require('@sindresorhus/is');
const semverComposer = require('../../versioning/composer');

module.exports = {
  extractPackageFile,
};

/**
 * Parse the repositories field from a composer.json or the config
 *
 * Entries with type vcs, git, gitlab or github will be added to repositories,
 * other entries will be added to registryUrls
 *
 * @param repoJson
 * @param repositories
 * @param registryUrls
 */
function parseRepos(repoJson, repositories, registryUrls) {
  if (is.array(repoJson)) {
    repoJson.forEach(repo => {
      if (repo.type && !['vcs', 'git'].indexOf(repo.type) !== -1) {
        // eslint-disable-next-line no-param-reassign
        repositories[repo.name] = repo;
      } else {
        registryUrls.push(repo);
      }
    });
  } else if (is.object(repoJson)) {
    try {
      for (const repository of Object.values(repoJson)) {
        registryUrls.push(repository);
      }
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Error extracting composer repositories');
    }
  } /* istanbul ignore next */ else {
    logger.info({ repositories: repoJson }, 'Unknown composer repositories');
  }
}

async function extractPackageFile(content, fileName, config) {
  logger.trace(`composer.extractPackageFile(${fileName})`);
  let composerJson;
  try {
    composerJson = JSON.parse(content);
  } catch (err) {
    logger.info({ fileName }, 'Invalid JSON');
    return null;
  }
  const repositories = {};
  const registryUrls = [];
  const res = {};
  if (config && config.composer && config.composer.repositories) {
    parseRepos(config.composer.repositories, repositories, registryUrls);
  }
  if (composerJson.repositories) {
    parseRepos(composerJson.repositories, repositories, registryUrls);
  }
  if (registryUrls.length !== 0) {
    res.registryUrls = registryUrls;
  }
  const deps = [];
  const depTypes = ['require', 'require-dev'];
  for (const depType of depTypes) {
    if (composerJson[depType]) {
      try {
        for (const [depName, version] of Object.entries(
          composerJson[depType]
        )) {
          const currentValue = version.trim();
          // Default datasource and lookupName
          let datasource = 'packagist';
          let lookupName = depName;

          // Check custom repositories by type
          if (repositories[depName]) {
            switch (repositories[depName].type) {
              case 'vcs':
              case 'git':
                datasource = 'gitTags';
                lookupName = repositories[depName].url;
                break;
              default:
                break;
            }
          }
          const dep = {
            depType,
            depName,
            currentValue,
            datasource,
            lookupName,
          };
          if (!depName.includes('/')) {
            dep.skipReason = 'unsupported';
          }
          if (!semverComposer.isValid(currentValue)) {
            dep.skipReason = 'unsupported-constraint';
          }
          if (currentValue === '*') {
            dep.skipReason = 'any-version';
          }
          deps.push(dep);
        }
      } catch (err) /* istanbul ignore next */ {
        logger.info({ fileName, depType, err }, 'Error parsing composer.json');
        return null;
      }
    }
  }
  if (!deps.length) {
    return null;
  }
  res.deps = deps;
  const filePath = fileName.replace(/\.json$/, '.lock');
  const lockContents = await platform.getFile(filePath);
  // istanbul ignore if
  if (lockContents) {
    logger.debug({ packageFile: fileName }, 'Found composer lock file');
    res.composerLock = filePath;
    try {
      const lockParsed = JSON.parse(lockContents);
      for (const dep of res.deps) {
        const lockedDep = lockParsed.packages.find(
          item => item.name === dep.depName
        );
        if (lockedDep && semverComposer.isVersion(lockedDep.version)) {
          dep.lockedVersion = lockedDep.version.replace(/^v/i, '');
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Error processing composer.lock');
    }
  } else {
    res.composerLock = false;
  }
  if (composerJson.type) {
    res.composerJsonType = composerJson.type;
  }
  return res;
}
