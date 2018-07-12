const path = require('path');
const upath = require('upath');

const semverComposer = require('../../versioning')('semverComposer');

module.exports = {
  extractDependencies,
};

async function extractDependencies(content, packageFile) {
  logger.debug('composer.extractDependencies()');
  let packageJson;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.info({ packageFile }, 'Invalid JSON');
    return null;
  }
  const deps = [];
  const depTypes = ['require', 'require-dev'];
  for (const depType of depTypes) {
    if (packageJson[depType]) {
      try {
        for (const [depName, version] of Object.entries(packageJson[depType])) {
          const currentValue = version.trim();
          const dep = {
            depType,
            depName,
            currentValue,
            versionScheme: 'semverComposer',
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
          { packageFile, depType, err, message: err.message },
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
  const filePath = upath.join(
    path.dirname(packageFile.packageFile),
    'composer.lock'
  );
  if (await platform.getFile(filePath)) {
    logger.debug(
      { packageFile: packageFile.packageFile },
      'Found composer.lock'
    );
    composerLock = filePath;
  }
  return { deps, composerLock };
}
