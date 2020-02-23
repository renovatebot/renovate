import { dequal } from 'dequal';
import { logger } from '../../../../logger';
import { matchAt, replaceAt } from '../../../../util/string';
import type { UpdateDependencyConfig } from '../../../types';

function replaceAsString(
  parsedContents: any,
  fileContent: string,
  depType: string,
  depName: string,
  oldVersion: string,
  newValue: string
): string | null {
  // Update the file = this is what we want
  // eslint-disable-next-line no-param-reassign
  if (depName === oldVersion) {
    delete Object.assign(parsedContents[depType], {
      [newValue]: parsedContents[depType][oldVersion],
    })[oldVersion];
  } else if (depType === 'resolutions') {
    // eslint-disable-next-line no-param-reassign
    parsedContents.resolutions[depName] = newValue;
  } else {
    // eslint-disable-next-line no-param-reassign
    parsedContents[depType][depName] = newValue;
  }
  // Look for the old version number
  const searchString = `"${oldVersion}"`;
  const newString = `"${newValue}"`;
  // Skip ahead to depType section
  let searchIndex = fileContent.indexOf(`"${depType}"`) + depType.length;
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
      if (dequal(parsedContents, JSON.parse(testContent))) {
        return testContent;
      }
    }
  }
  // istanbul ignore next: not possible to get here
  return null;
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depType, managerData } = upgrade;
  const depName: string = managerData?.key || upgrade.depName;
  let { newValue } = upgrade;
  if (upgrade.currentRawValue) {
    if (upgrade.currentDigest) {
      logger.debug('Updating package.json git digest');
      newValue = upgrade.currentRawValue.replace(
        upgrade.currentDigest,
        upgrade.newDigest.substring(0, upgrade.currentDigest.length)
      );
    } else {
      logger.debug('Updating package.json git version tag');
      newValue = upgrade.currentRawValue.replace(
        upgrade.currentValue,
        upgrade.newValue
      );
    }
  }
  if (upgrade.npmPackageAlias) {
    newValue = `npm:${upgrade.lookupName}@${newValue}`;
  }
  logger.debug(`npm.updateDependency(): ${depType}.${depName} = ${newValue}`);
  try {
    const parsedContents = JSON.parse(fileContent);
    // Save the old version
    const oldVersion: string = parsedContents[depType][depName];
    if (oldVersion === newValue) {
      logger.trace('Version is already updated');
      return fileContent;
    }
    let newFileContent = replaceAsString(
      parsedContents,
      fileContent,
      depType,
      depName,
      oldVersion,
      newValue
    );
    if (upgrade.newName) {
      newFileContent = replaceAsString(
        parsedContents,
        newFileContent,
        depType,
        depName,
        depName,
        upgrade.newName
      );
    }
    // istanbul ignore if
    if (!newFileContent) {
      logger.debug(
        { fileContent, parsedContents, depType, depName, newValue },
        'Warning: updateDependency error'
      );
      return fileContent;
    }
    if (parsedContents?.resolutions) {
      let depKey: string;
      if (parsedContents.resolutions[depName]) {
        depKey = depName;
      } else if (parsedContents.resolutions[`**/${depName}`]) {
        depKey = `**/${depName}`;
      }
      if (depKey) {
        // istanbul ignore if
        if (parsedContents.resolutions[depKey] !== oldVersion) {
          logger.debug(
            {
              depName,
              depKey,
              oldVersion,
              resolutionsVersion: parsedContents.resolutions[depKey],
            },
            'Upgraded dependency exists in yarn resolutions but is different version'
          );
        }
        newFileContent = replaceAsString(
          parsedContents,
          newFileContent,
          'resolutions',
          depKey,
          parsedContents.resolutions[depKey],
          newValue
        );
      }
    }
    return newFileContent;
  } catch (err) {
    logger.debug({ err }, 'updateDependency error');
    return null;
  }
}
