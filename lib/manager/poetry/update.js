const _ = require('lodash');
const toml = require('toml');

const { logger } = require('../../logger');

module.exports = {
  updateDependency,
};

// TODO: Maybe factor out common code from pipenv.updateDependency and poetry.updateDependency
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
  logger.trace({ config: upgrade }, 'poetry.updateDependency()');
  if (!upgrade) {
    return null;
  }
  const { depType, depName, newValue, nestedVersion } = upgrade;
  const parsedContents = toml.parse(fileContent);
  if (!parsedContents.tool.poetry[depType]) {
    logger.info(
      { config: upgrade },
      `Error: Section tool.poetry.${depType} doesn't exist in pyproject.toml file, update failed`
    );
    return null;
  }
  let oldVersion;
  if (nestedVersion) {
    const oldDep = parsedContents.tool.poetry[depType][depName];
    if (!oldDep) {
      logger.info(
        { config: upgrade },
        `Could not get version of dependency ${depType}, update failed (most likely name is invalid)`
      );
      return null;
    }
    oldVersion = oldDep.version;
  } else {
    oldVersion = parsedContents.tool.poetry[depType][depName];
  }
  if (!oldVersion) {
    logger.info(
      { config: upgrade },
      `Could not get version of dependency ${depType}, update failed (most likely name is invalid)`
    );
    return null;
  }
  if (oldVersion === newValue) {
    logger.info('Version is already updated');
    return fileContent;
  }
  if (nestedVersion) {
    parsedContents.tool.poetry[depType][depName].version = newValue;
  } else {
    parsedContents.tool.poetry[depType][depName] = newValue;
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
  return newFileContent;
}
