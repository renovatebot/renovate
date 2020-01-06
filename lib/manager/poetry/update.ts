import { isEqual } from 'lodash';
import { parse } from 'toml';
import { logger } from '../../logger';
import { Upgrade } from '../common';
import { PoetryFile } from './types';

// TODO: Maybe factor out common code from pipenv.updateDependency and poetry.updateDependency
// Return true if the match string is found at index in content
function matchAt(content: string, index: number, match: string): boolean {
  return (
    content.substring(index, index + match.length + 2) === `"${match}"` ||
    content.substring(index, index + match.length + 2) === `'${match}'`
  );
}

// Replace oldString with newString at location index of content
function replaceAt(
  content: string,
  index: number,
  oldString: string,
  newString: string
): string {
  logger.debug(
    `Replacing \`${oldString}\` with ${newString} at index ${index}`
  );
  return (
    content.substr(0, index) +
    newString +
    content.substr(index + oldString.length + 2)
  );
}

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade<{ nestedVersion?: boolean }>
): string | null {
  logger.trace({ config: upgrade }, 'poetry.updateDependency()');
  if (!upgrade) {
    return null;
  }
  const { depType, depName, newValue, managerData } = upgrade;
  const { nestedVersion } = managerData;
  const parsedContents: PoetryFile = parse(fileContent);
  if (!parsedContents.tool.poetry[depType]) {
    logger.info(
      { config: upgrade },
      `Error: Section tool.poetry.${depType} doesn't exist in pyproject.toml file, update failed`
    );
    return null;
  }
  let oldVersion: string;
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
  const searchString = `${oldVersion}`;
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
  return newFileContent;
}
