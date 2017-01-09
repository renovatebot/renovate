const _ = require('lodash');

module.exports = {
  setNewValue: function(currentFileContent, depType, depName, newVersion) {
    const parsedContents = JSON.parse(currentFileContent);
    // Save the old version
    const oldVersion = parsedContents[depType][depName];
    // Update the file = this is what we want
    parsedContents[depType][depName] = newVersion;
    // Look for the old version number
    const versionHits = indexes(currentFileContent, `"${oldVersion}"`);
    let newSource = null;
    // Loop through all instances of string until one matches
    versionHits.some(function(index) {
      // Replace the string and parse the result
      const testSource = replaceStringAtIndex(currentFileContent, oldVersion, newVersion, index+1);
      if (_.isEqual(parsedContents, JSON.parse(testSource))) {
        newSource = testSource;
        return true;
      }
    });
    return newSource;
  }
};

function indexes(currentFileContent, find) {
  var result = [];
  for (i = 0; i < currentFileContent.length; ++i) {
    if (currentFileContent.substring(i, i + find.length) == find) {
      result.push(i);
    }
  }
  return result;
}

function replaceStringAtIndex(currentFileContent, oldStr, newStr, index) {
  return currentFileContent.substr(0, index) + newStr + currentFileContent.substr(index + oldStr.length);
}
