
module.exports = {
  extractDependencies,
};

function extractDependencies(content, packageFile) {
  logger.debug('composer.extractDependencies()');
  let packageJson;
  try {
    packageJson = JSON.parse(content);
  } catch (err) {
    logger.info({ packageFile }, 'Invalid JSON');
    return null;
  }
  const deps = [];
  const depTypes = [
    'require',
    'require-dev',
  ];
  for (const depType of depTypes) {
    if (packageJson[depType]) {
      try {
        for (const [depName, version] of Object.entries(packageJson[depType])) {
          if (depName.includes('/')) {
            deps.push({
              depName,
              depType,
              currentVersion: version.trim().replace(/^/, ''),
            });
          }
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
  return { deps };
}
