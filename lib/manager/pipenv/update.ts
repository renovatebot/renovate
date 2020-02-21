import { isEqual } from 'lodash';
import { parse } from 'toml';
import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';
import { matchAt, replaceAt } from '../../util/string';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
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
