const _ = require('lodash');

let logger = null;

module.exports = {
  setLogger,
  setNewValue,
};

function setLogger(l) {
  logger = l;
}

function setNewValue(currentFileContent, depType, depName, newVersion) {
  logger.debug(`setNewValue: ${depType}.${depName} = ${newVersion}`);
  const parsedContents = JSON.parse(currentFileContent);
  // Save the old version
  const oldVersion = parsedContents[depType][depName];
  // Update the file = this is what we want
  parsedContents[depType][depName] = newVersion;
  // Look for the old version number
  const searchString = `"${oldVersion}"`;
  const newString = `"${newVersion}"`;
  let newFileContent = null;
  // Skip ahead to depType section
  let searchIndex = currentFileContent.indexOf(`"${depType}"`) + depType.length;
  logger.debug(`Starting search at index ${searchIndex}`);
  // Iterate through the rest of the file
  for (; searchIndex < currentFileContent.length; searchIndex += 1) {
    // First check if we have a hit for the old version
    if (matchAt(currentFileContent, searchIndex, searchString)) {
      logger.debug(`Found match at index ${searchIndex}`);
      // Now test if the result matches
      const testContent = replaceAt(currentFileContent, searchIndex, searchString, newString);
      // Compare the parsed JSON structure of old and new
      if (_.isEqual(parsedContents, JSON.parse(testContent))) {
        newFileContent = testContent;
        break;
      }
    }
  }
  // istanbul ignore if
  if (!newFileContent) {
    throw new Error('Could not set new value');
  }
  return newFileContent;
}

// Return true if the match string is found at index in content
function matchAt(content, index, match) {
  return content.substring(index, index + match.length) === match;
}

// Replace oldString with newString at location index of content
function replaceAt(content, index, oldString, newString) {
  logger.debug(`Replacing ${oldString} with ${newString} at index ${index}`);
  return content.substr(0, index) + newString + content.substr(index + oldString.length);
}
