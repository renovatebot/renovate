import { dequal } from 'dequal';
import type { PackageJson } from 'type-fest';
import { logger } from '../../../../../logger';
import { regEx } from '../../../../../util/regex';
import { matchAt, replaceAt } from '../../../../../util/string';
import type { UpdateDependencyConfig } from '../../../types';

const patchReg = regEx('(patch:.*@(npm:)?).*#.*');

function replaceAsString(
  parsedContents: PackageJson,
  fileContent: string,
  depType: string,
  depName: string,
  oldValue: string,
  newValue: string
): string | null {
  if (depType === 'packageManager') {
    parsedContents[depType] = newValue;
  } else if (depName === oldValue) {
    // The old value is the name of the dependency itself
    delete Object.assign(parsedContents[depType], {
      [newValue]: parsedContents[depType][oldValue],
    })[oldValue];
  } else {
    // The old value is the version of the dependency
    parsedContents[depType][depName] = newValue;
  }
  // Look for the old version number
  const searchString = `"${oldValue}"`;
  let newString = `"${newValue}"`;

  if (patchReg.test(oldValue)) {
    const replaceRegex = regEx(`(patch:${depName}@(npm:)?).*#`);
    const match = patchReg.exec(oldValue);
    const patch = oldValue.replace(replaceRegex, `${match[1]}${newValue}#`);
    if (patch) {
      parsedContents[depType][depName] = patch;
      newString = `"${patch}"`;
    }
  }

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
  // istanbul ignore next
  throw new Error();
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
    newValue = `npm:${upgrade.packageName}@${newValue}`;
  }
  logger.debug(`npm.updateDependency(): ${depType}.${depName} = ${newValue}`);
  try {
    const parsedContents: PackageJson = JSON.parse(fileContent);
    // Save the old version
    let oldVersion: string;
    if (depType === 'packageManager') {
      oldVersion = parsedContents[depType];
      newValue = `${depName}@${newValue}`;
    } else {
      oldVersion = parsedContents[depType][depName];
    }
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
        if (upgrade.newName) {
          if (depKey === `**/${depName}`) {
            // handles the case where a replacement is in a resolution
            upgrade.newName = `**/${upgrade.newName}`;
          }
          newFileContent = replaceAsString(
            parsedContents,
            newFileContent,
            'resolutions',
            depKey,
            depKey,
            upgrade.newName
          );
        }
      }
    }
    return newFileContent;
  } catch (err) {
    logger.debug({ err }, 'updateDependency error');
    return null;
  }
}
