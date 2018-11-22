const _ = require('lodash');
const toml = require('toml');

module.exports = {
  updateDependency,
};

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

function updateDependency(fileContent, upgrade) {
  try {
    const { depType, depName, newValue, pipenvNestedVersion } = upgrade;
    logger.debug(`pipenv.updateDependency(): ${newValue}`);
    const parsedContents = toml.parse(fileContent);
    let oldVersion;
    if (pipenvNestedVersion) {
      oldVersion = parsedContents[depType][depName].version;
    } else {
      oldVersion = parsedContents[depType][depName];
    }
    if (oldVersion === newValue) {
      logger.info('Version is already updated');
      return fileContent;
    }
    if (pipenvNestedVersion) {
      parsedContents[depType][depName].version = newValue;
    } else {
      parsedContents[depType][depName] = newValue;
    }
    const searchString = `"${oldVersion}"`;
    const newString = `"${newValue}"`;
    let newFileContent = null;
    let searchIndex = fileContent.indexOf(`[${depType}]`) + depType.length;
    for (; searchIndex < fileContent.length; searchIndex += 1) {
      // First check if we have a hit for the old version
      if (matchAt(fileContent, searchIndex, searchString)) {
        logger.trace(`Found match at index ${searchIndex}`);
        // Now test if the result matches
        const testContent = replaceAt(
          fileContent,
          searchIndex,
          searchString,
          newString
        );
        // Compare the parsed toml structure of old and new
        if (_.isEqual(parsedContents, toml.parse(testContent))) {
          newFileContent = testContent;
          break;
        } else {
          logger.debug('Mismatched replace at searchIndex ' + searchIndex);
        }
      }
    }
    // istanbul ignore if
    if (!newFileContent) {
      logger.info(
        { fileContent, parsedContents, depType, depName, newValue },
        'Warning: updateDependency error'
      );
      return fileContent;
    }
    return newFileContent;
  } catch (err) {
    logger.info({ err }, 'Error setting new package version');
    return null;
  }
}
