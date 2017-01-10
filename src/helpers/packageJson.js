const _ = require('lodash');

module.exports = {
  setNewValue(currentFileContent, depType, depName, newVersion) {
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
    let searchIndex = currentFileContent.indexOf(`"${depType}"`) +
      depType.length;
    // Iterate through the rest of the file
    for (; searchIndex < currentFileContent.length; searchIndex += 1) {
      // First check if we have a hit for the old version
      if (currentFileContent.substring(searchIndex, searchIndex + searchString.length) === searchString) {
        // Now test if the result matches
        const testContent = currentFileContent.substr(0, searchIndex) +
          newString +
          currentFileContent.substr(searchIndex + searchString.length);
        // Compare the parsed JSON structure of old and new
        if (_.isEqual(parsedContents, JSON.parse(testContent))) {
          newFileContent = testContent;
          break;
        }
      }
    }
    if (!newFileContent) {
      throw new Error('Could not find old version');
    }
    return newFileContent;
  },
};
