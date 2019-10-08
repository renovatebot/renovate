import _ from 'lodash';
import yaml from 'js-yaml';
import is from '@sindresorhus/is';

import { logger } from '../../logger';

export function updateDependency(fileContent, upgrade) {
  logger.trace({ config: upgrade }, 'updateDependency()');
  if (!upgrade || !upgrade.depName || !upgrade.newValue) {
    logger.debug('Failed to update dependency, invalid upgrade');
    return fileContent;
  }
  const doc = yaml.safeLoad(fileContent);
  if (!doc || !is.array(doc.dependencies)) {
    logger.debug('Failed to update dependency, invalid requirements.yaml file');
    return fileContent;
  }
  const { depName, newValue } = upgrade;
  const oldVersion = doc.dependencies.filter(dep => dep.name === depName)[0]
    .version;
  doc.dependencies = doc.dependencies.map(dep =>
    dep.name === depName ? { ...dep, version: newValue } : dep
  );
  const searchString = `${oldVersion}`;
  const newString = `${newValue}`;
  let newFileContent = fileContent;
  // Search starts at 'dependencies' instead of `${depName}` because fields in a YAML record
  // can be in arbitrary order for example like this:
  /*
  dependencies:
    - version: 0.11.0
      name: redis
      repository: https://kubernetes-charts.storage.googleapis.com/
    - version: 0.8.1
      name: postgresql
      repository: https://kubernetes-charts.storage.googleapis.com/
  */
  let searchIndex = fileContent.indexOf('dependencies') + 'dependencies'.length;
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
      // Compare the parsed yaml structure of old and new
      if (_.isEqual(doc, yaml.safeLoad(testContent))) {
        newFileContent = testContent;
        break;
      } else {
        logger.debug('Mismatched replace at searchIndex ' + searchIndex);
      }
    }
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
  return (
    content.substr(0, index) +
    newString +
    content.substr(index + oldString.length)
  );
}
