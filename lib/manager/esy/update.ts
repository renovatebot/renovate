import { isEqual } from 'lodash';
import { logger } from '../../logger';
import { Upgrade } from '../common';

export function updateDependency(fileContent: string, upgrade: Upgrade) {
  logger.trace(`updateDependency(${upgrade.depName})`);
  const { depType, depName, newValue, currentValue } = upgrade;
  try {
    const parsedContents = JSON.parse(fileContent);
    const oldVersion = parsedContents[depType][depName];
    if (oldVersion !== currentValue) {
      logger.warn(
        `Actual value in ${depType}.${depName} = ${oldVersion} is not equal to currentValue = ${currentValue}`
      );
    }
    if (oldVersion === newValue) {
      logger.trace('Version is already updated');
      return fileContent;
    }
    parsedContents[depType][depName] = newValue;
    const searchString = `"${oldVersion}"`;
    const newString = `"${newValue}"`;
    let newFileContent = null;
    let searchIndex = fileContent.indexOf(`"${depType}"` + depType.length);
    logger.trace(`Starting search at index ${searchIndex}`);
    // Iterate through the rest of the file
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
        // Compare the parsed JSON structure of old and new
        if (isEqual(parsedContents, JSON.parse(testContent))) {
          newFileContent = testContent;
          break;
        }
      }
    }
    if (!newFileContent) {
      logger.info(
        { fileContent, parsedContents, depType, depName, newValue },
        'Warning: updateDependency error'
      );
      return fileContent;
    }
    return newFileContent;
  } catch (err) {
    logger.info({ err }, 'updateDependency error');
    return null;
  }
}

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
