const _ = require('lodash');
const toml = require('toml');

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
    return fileContent;
  }
  const { platform, depType, depName, newValue, nestedVersion } = upgrade;
  let parsedContent;
  try {
    parsedContent = toml.parse(fileContent);
  } catch (err) {
    logger.debug({ err }, 'Error parsing Cargo.toml file');
    return fileContent;
  }
  let section;
  if (platform) {
    section = parsedContent.target[platform][depType];
  } else {
    section = parsedContent[depType];
  }
  if (!section) {
    if (platform) {
      logger.info(
        { config: upgrade },
        `Error: Section [target.${platform}.${depType}] doesn't exist in Cargo.toml file, update failed`
      );
    } else {
      logger.info(
        { config: upgrade },
        `Error: Section [${depType}] doesn't exist in Cargo.toml file, update failed`
      );
    }
    return fileContent;
  }
  let oldVersion;
  const oldDep = section[depName];
  if (!oldDep) {
    logger.info(
      { config: upgrade },
      `Could not get version of dependency ${depName}, update failed (most likely name is invalid)`
    );
    return fileContent;
  }
  oldVersion = section[depName];
  // if (typeof oldVersion !== 'string') {
  //   if (oldVersion.version) {
  //     oldVersion = oldVersion.version;
  //   } else {
  //     oldVersion = null;
  //   }
  // }
  if (nestedVersion) {
    oldVersion = oldVersion.version;
  }
  if (!oldVersion) {
    logger.info(
      { config: upgrade },
      `Could not get version of dependency ${depName}, update failed (most likely name is invalid)`
    );
    return fileContent;
  }
  if (oldVersion === newValue) {
    logger.info('Version is already updated');
    return fileContent;
  }
  if (nestedVersion) {
    section[depName].version = newValue;
  } else {
    section[depName] = newValue;
  }
  if (platform) {
    parsedContent.target[platform][depType] = section;
  } else {
    parsedContent[depType] = section;
  }
  const searchString = `"${oldVersion}"`;
  const newString = `"${newValue}"`;
  let newFileContent = fileContent;
  let searchIndex = fileContent.indexOf(`${depName}`) + depName.length;
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
      if (_.isEqual(parsedContent, toml.parse(testContent))) {
        newFileContent = testContent;
        break;
      } else {
        logger.debug('Mismatched replace at searchIndex ' + searchIndex);
      }
    }
  }
  return newFileContent;
}
