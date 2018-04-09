const _ = require('lodash');
const semver = require('semver');

module.exports = {
  updateDependency,
  bumpPackageVersion,
};

function updateDependency(fileContent, upgrade) {
  const { depType, depName, newVersion } = upgrade;
  logger.debug(`npm.updateDependency(): ${depType}.${depName} = ${newVersion}`);
  try {
    const parsedContents = JSON.parse(fileContent);
    // Save the old version
    const oldVersion = parsedContents[depType][depName];
    if (oldVersion === newVersion) {
      logger.debug('Version is already updated');
      return fileContent;
    }
    // Update the file = this is what we want
    parsedContents[depType][depName] = newVersion;
    // Look for the old version number
    const searchString = `"${oldVersion}"`;
    const newString = `"${newVersion}"`;
    let newFileContent = null;
    // Skip ahead to depType section
    let searchIndex = fileContent.indexOf(`"${depType}"`) + depType.length;
    logger.debug(`Starting search at index ${searchIndex}`);
    // Iterate through the rest of the file
    for (; searchIndex < fileContent.length; searchIndex += 1) {
      // First check if we have a hit for the old version
      if (matchAt(fileContent, searchIndex, searchString)) {
        logger.debug(`Found match at index ${searchIndex}`);
        // Now test if the result matches
        const testContent = replaceAt(
          fileContent,
          searchIndex,
          searchString,
          newString
        );
        // Compare the parsed JSON structure of old and new
        if (_.isEqual(parsedContents, JSON.parse(testContent))) {
          newFileContent = testContent;
          break;
        }
      }
    }
    // istanbul ignore if
    if (!newFileContent) {
      logger.info(
        { fileContent, parsedContents, depType, depName, newVersion },
        'Warning: updateDependency error'
      );
      return fileContent;
    }
    if (
      parsedContents &&
      parsedContents.resolutions &&
      parsedContents.resolutions[depName]
    ) {
      if (parsedContents.resolutions[depName] === oldVersion) {
        // Update the file = this is what we want
        parsedContents.resolutions[depName] = newVersion;
        // Look for the old version number
        const oldResolution = `"${oldVersion}"`;
        const newResolution = `"${newVersion}"`;
        // Skip ahead to depType section
        searchIndex = newFileContent.indexOf(`"resolutions"`);
        logger.debug(`Starting search at index ${searchIndex}`);
        // Iterate through the rest of the file
        for (; searchIndex < newFileContent.length; searchIndex += 1) {
          // First check if we have a hit for the old version
          if (matchAt(newFileContent, searchIndex, oldResolution)) {
            logger.debug(`Found match at index ${searchIndex}`);
            // Now test if the result matches
            const testContent = replaceAt(
              newFileContent,
              searchIndex,
              oldResolution,
              newResolution
            );
            // Compare the parsed JSON structure of old and new
            if (_.isEqual(parsedContents, JSON.parse(testContent))) {
              newFileContent = testContent;
              break;
            }
          }
        }
      } else {
        // istanbul ignore next
        logger.warn(
          { parsedContents },
          'Upgraded dependency exists in yarn resolutions but is different version'
        );
      }
    }
    return bumpPackageVersion(
      newFileContent,
      upgrade.currentPackageJsonVersion,
      upgrade.bumpVersion
    );
  } catch (err) {
    logger.info({ err }, 'updateDependency error');
    return null;
  }
}

// Return true if the match string is found at index in content
function matchAt(content, index, match) {
  return content.substring(index, index + match.length) === match;
}

// Replace oldString with newString at location index of content
function replaceAt(content, index, oldString, newString) {
  logger.debug(`Replacing ${oldString} with ${newString} at index ${index}`);
  return (
    content.substr(0, index) +
    newString +
    content.substr(index + oldString.length)
  );
}

function bumpPackageVersion(content, currentVersion, bumpVersion) {
  logger.debug('bumpVersion()');
  if (!bumpVersion) {
    return content;
  }
  logger.debug(
    { bumpVersion },
    'Checking if we should bump package.json version'
  );
  try {
    const newPjVersion = semver.inc(currentVersion, bumpVersion);
    const bumpedContent = content.replace(
      /("version":\s*")[^"]*/,
      `$1${newPjVersion}`
    );
    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.info('Bumped package.json version');
    }
    return bumpedContent;
  } catch (err) {
    logger.warn(
      {
        content,
        currentVersion,
        bumpVersion,
      },
      'Failed to bumpVersion'
    );
    return content;
  }
}
