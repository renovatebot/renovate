const is = require('@sindresorhus/is');
const semverComposer = require('../../versioning/composer');

module.exports = {
  extractPackageFile,
};

async function extractPackageFile(content, fileName) {
  logger.trace(`composer.extractPackageFile(${fileName})`);
  let composerJson;
  try {
    composerJson = JSON.parse(content);
  } catch (err) {
    logger.info({ fileName }, 'Invalid JSON');
    return null;
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
          const dep = {
            depType,
            depName,
            currentValue,
            purl: 'pkg:packagist/' + depName,
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
        logger.info(
          { fileName, depType, err, message: err.message },
          'Error parsing composer.json'
        );
        return null;
      }
    }
  }
  if (!deps.length) {
    return null;
  }
  let composerLock = false;
  const filePath = fileName.replace(/\.json$/, '.lock');
  if (await platform.getFile(filePath)) {
    logger.debug({ packageFile: fileName }, 'Found composer lock file');
    composerLock = filePath;
  }
  const res = { deps, composerLock };
  if (composerJson.repositories) {
    if (is.array(composerJson.repositories)) {
      res.registryUrls = composerJson.repositories;
    } else if (is.object(composerJson.repositories)) {
      try {
        res.registryUrls = [];
        for (const repository of Object.values(composerJson.repositories)) {
          res.registryUrls.push(repository);
        }
      } catch (err) /* istanbul ignore next */ {
        logger.info({ err }, 'Error extracting composer repositories');
      }
    } /* istanbul ignore next */ else {
      logger.info(
        { repositories: composerJson.repositories },
        'Unknown composer repositories'
      );
    }
  }
  if (composerJson.type) {
    res.composerJsonType = composerJson.type;
  }
  return res;
}
