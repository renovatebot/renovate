import is from '@sindresorhus/is';

const { logger } = require('../../logger');
const semverComposer = require('../../versioning/composer');

export { extractPackageFile };

/**
 * Parse the repositories field from a composer.json
 *
 * Entries with type vcs or git will be added to repositories,
 * other entries will be added to registryUrls
 *
 * @param repoJson
 * @param repositories
 * @param registryUrls
 */
function parseRepositories(repoJson, repositories, registryUrls) {
  try {
    Object.entries(repoJson).forEach(([key, repo]) => {
      const name = is.array(repoJson) ? repo.name : key;
      switch (repo.type) {
        case 'vcs':
        case 'git':
          // eslint-disable-next-line no-param-reassign
          repositories[name] = repo;
          break;
        default:
          registryUrls.push(repo);
      }
    });
  } catch (e) /* istanbul ignore next */ {
    logger.info(
      { repositories: repoJson },
      'Error parsing composer.json repositories config'
    );
  }
}

async function extractPackageFile(content, fileName) {
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

  // handle lockfile
  const lockfilePath = fileName.replace(/\.json$/, '.lock');
  const lockContents = await platform.getFile(lockfilePath);
  let lockParsed;
  if (lockContents) {
    logger.debug({ packageFile: fileName }, 'Found composer lock file');
    res.composerLock = lockfilePath;
    try {
      lockParsed = JSON.parse(lockContents);
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Error processing composer.lock');
    }
  } else {
    res.composerLock = false;
  }

  // handle composer.json repositories
  if (composerJson.repositories) {
    parseRepositories(composerJson.repositories, repositories, registryUrls);
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
            // eslint-disable-next-line default-case
            switch (repositories[depName].type) {
              case 'vcs':
              case 'git':
                datasource = 'gitTags';
                lookupName = repositories[depName].url;
                break;
            }
          }
          const dep = {
            depType,
            depName,
            currentValue,
            datasource,
          };
          if (depName !== lookupName) {
            dep.lookupName = lookupName;
          }
          if (!depName.includes('/')) {
            dep.skipReason = 'unsupported';
          }
          if (!semverComposer.isValid(currentValue)) {
            dep.skipReason = 'unsupported-constraint';
          }
          if (currentValue === '*') {
            dep.skipReason = 'any-version';
          }
          if (lockParsed) {
            const lockedDep = lockParsed.packages.find(
              item => item.name === dep.depName
            );
            if (lockedDep && semverComposer.isVersion(lockedDep.version)) {
              dep.lockedVersion = lockedDep.version.replace(/^v/i, '');
            }
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
  if (composerJson.type) {
    res.composerJsonType = composerJson.type;
  }
  return res;
}
