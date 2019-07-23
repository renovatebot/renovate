import { isEqual } from 'lodash';
import { parse } from 'toml';
import { logger } from '../../logger';
import { Upgrade } from '../common';

// Return true if the match string is found at index in content
function matchAt(content: string, index: number, match: string) {
  return content.substring(index, index + match.length) === match;
}

// Replace oldString with newString at location index of content
function replaceAt(
  content: string,
  index: number,
  oldString: string,
  newString: string
) {
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
): string {
  try {
    const { depType, depName, newValue, managerData = {} } = upgrade;
    const { nestedVersion } = managerData;
    logger.debug(`pipenv.updateDependency(): ${newValue}`);
    const parsedContents = parse(fileContent);
    let oldVersion: string;
    if (nestedVersion) {
      oldVersion = parsedContents[depType][depName].version;
    } else {
      oldVersion = parsedContents[depType][depName];
    }
    if (oldVersion === newValue) {
      logger.info('Version is already updated');
      return fileContent;
    }
    if (nestedVersion) {
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
        if (isEqual(parsedContents, parse(testContent))) {
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
