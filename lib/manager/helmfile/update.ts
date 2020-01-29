import _ from 'lodash';
import yaml from 'js-yaml';
import is from '@sindresorhus/is';

import { logger } from '../../logger';
import { Upgrade } from '../common';

// Return true if the match string is found at index in content
function matchAt(content: string, index: number, match: string): boolean {
  return content.substring(index, index + match.length) === match;
}

// Replace oldString with newString at location index of content
function replaceAt(
  content: string,
  index: number,
  oldString: string,
  newString: string
): string {
  logger.debug(`Replacing ${oldString} with ${newString} at index ${index}`);
  return (
    content.substr(0, index) +
    newString +
    content.substr(index + oldString.length)
  );
}

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  logger.trace({ config: upgrade }, 'updateDependency()');
  if (!upgrade || !upgrade.depName || !upgrade.newValue) {
    logger.debug('Failed to update dependency, invalid upgrade');
    return fileContent;
  }
  const doc = yaml.safeLoad(fileContent, { json: true });
  if (!doc || !is.array(doc.releases)) {
    logger.debug('Failed to update dependency, invalid helmfile.yaml file');
    return fileContent;
  }
  const { depName, newValue } = upgrade;
  logger.debug({ depName });
  const oldVersion = doc.releases.filter(
    dep => dep.chart.split('/')[1] === depName
  )[0].version;
  doc.releases = doc.releases.map(dep =>
    dep.chart.split('/')[1] === depName ? { ...dep, version: newValue } : dep
  );
  const searchString = `${oldVersion}`;
  const newString = `${newValue}`;
  let newFileContent = fileContent;

  let searchIndex = fileContent.indexOf('releases') + 'releases'.length;
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
      if (_.isEqual(doc, yaml.safeLoad(testContent, { json: true }))) {
        newFileContent = testContent;
        break;
      } else {
        logger.debug('Mismatched replace at searchIndex ' + searchIndex);
      }
    }
  }
  return newFileContent;
}
