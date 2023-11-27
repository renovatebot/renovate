import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import { logger } from '../../../../../logger';
import { escapeRegExp, regEx } from '../../../../../util/regex';
import { matchAt, replaceAt } from '../../../../../util/string';
import type { UpdateDependencyConfig, Upgrade } from '../../../types';
import type {
  DependenciesMeta,
  NpmPackage,
  OverrideDependency,
  RecursiveOverride,
} from '../../extract/types';
import type { NpmDepType, NpmManagerData } from '../../types';

function renameObjKey(
  oldObj: DependenciesMeta,
  oldKey: string,
  newKey: string,
): DependenciesMeta {
  const keys = Object.keys(oldObj);
  return keys.reduce((acc, key) => {
    if (key === oldKey) {
      acc[newKey] = oldObj[oldKey];
    } else {
      acc[key] = oldObj[key];
    }
    return acc;
  }, {} as DependenciesMeta);
}

function replaceAsString(
  parsedContents: NpmPackage,
  fileContent: string,
  depType: NpmDepType | 'dependenciesMeta' | 'packageManager',
  depName: string,
  oldValue: string,
  newValue: string,
  parents?: string[],
): string {
  if (depType === 'packageManager') {
    parsedContents[depType] = newValue;
  } else if (depName === oldValue) {
    // The old value is the name of the dependency itself
    delete Object.assign(parsedContents[depType]!, {
      [newValue]: parsedContents[depType]![oldValue],
    })[oldValue];
  } else if (depType === 'dependenciesMeta') {
    if (oldValue !== newValue) {
      parsedContents.dependenciesMeta = renameObjKey(
        // TODO #22198
        parsedContents.dependenciesMeta!,
        oldValue,
        newValue,
      );
    }
  } else if (parents && depType === 'overrides') {
    // there is an object as a value in overrides block
    const { depObjectReference, overrideDepName } = overrideDepPosition(
      parsedContents[depType]!,
      parents,
      depName,
    );
    if (depObjectReference) {
      depObjectReference[overrideDepName] = newValue;
    }
  } else {
    // The old value is the version of the dependency
    parsedContents[depType]![depName] = newValue;
  }
  // Look for the old version number
  const searchString = `"${oldValue}"`;
  let newString = `"${newValue}"`;

  const escapedDepName = escapeRegExp(depName);
  const patchRe = regEx(`^(patch:${escapedDepName}@(npm:)?).*#`);
  const match = patchRe.exec(oldValue);
  if (match && depType === 'resolutions') {
    const patch = oldValue.replace(match[0], `${match[1]}${newValue}#`);
    parsedContents[depType]![depName] = patch;
    newString = `"${patch}"`;
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
        newString,
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
        // TODO #22198

        upgrade.newDigest!.substring(0, upgrade.currentDigest.length),
      );
    } else {
      logger.debug('Updating package.json git version tag');
      newValue = upgrade.currentRawValue.replace(
        upgrade.currentValue,
        upgrade.newValue,
      );
    }
  }
  if (upgrade.npmPackageAlias) {
    // TODO: types (#22198)
    newValue = `npm:${upgrade.packageName}@${newValue}`;
  }
  // TODO: types (#22198)
  logger.debug(`npm.updateDependency(): ${depType}.${depName} = ${newValue}`);
  try {
    const parsedContents: NpmPackage = JSON.parse(fileContent);
    let overrideDepParents: string[] | undefined = undefined;
    // Save the old version
    let oldVersion: string | undefined;
    if (depType === 'packageManager') {
      oldVersion = parsedContents[depType];
      // TODO: types (#22198)
      newValue = `${depName}@${newValue}`;
    } else if (isOverrideObject(upgrade)) {
      overrideDepParents = managerData?.parents;
      if (overrideDepParents) {
        // old version when there is an object as a value in overrides block
        const { depObjectReference, overrideDepName } = overrideDepPosition(
          parsedContents['overrides']!,
          overrideDepParents,
          depName,
        );
        if (depObjectReference) {
          oldVersion = depObjectReference[overrideDepName]!;
        }
      }
    } else {
      // eslint-disable @typescript-eslint/no-unnecessary-type-assertion
      oldVersion = parsedContents[depType as NpmDepType]![depName] as string;
    }
    if (oldVersion === newValue) {
      logger.trace('Version is already updated');
      return fileContent;
    }

    // TODO #22198
    let newFileContent = replaceAsString(
      parsedContents,
      fileContent,
      depType as NpmDepType,
      depName,
      oldVersion!,
      newValue!,
      overrideDepParents,
    );
    if (upgrade.newName) {
      newFileContent = replaceAsString(
        parsedContents,
        newFileContent,
        depType as NpmDepType,
        depName,
        depName,
        upgrade.newName,
        overrideDepParents,
      );
    }
    // istanbul ignore if
    if (!newFileContent) {
      logger.debug(
        { fileContent, parsedContents, depType, depName, newValue },
        'Warning: updateDependency error',
      );
      return fileContent;
    }
    if (parsedContents?.resolutions) {
      let depKey: string | undefined;
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
            'Upgraded dependency exists in yarn resolutions but is different version',
          );
        }
        newFileContent = replaceAsString(
          parsedContents,
          newFileContent,
          'resolutions',
          depKey,
          // TODO #22198
          parsedContents.resolutions[depKey]!,
          // TODO #22198
          newValue!,
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
            upgrade.newName,
          );
        }
      }
    }
    if (parsedContents?.dependenciesMeta) {
      for (const [depKey] of Object.entries(parsedContents.dependenciesMeta)) {
        if (depKey.startsWith(depName + '@')) {
          newFileContent = replaceAsString(
            parsedContents,
            newFileContent,
            'dependenciesMeta',
            depName,
            depKey,
            // TODO: types (#22198)
            `${depName}@${newValue}`,
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
function overrideDepPosition(
  overrideBlock: OverrideDependency,
  parents: string[],
  depName: string,
): {
  depObjectReference: Record<string, string>;
  overrideDepName: string;
} {
  // get override dep position when its nested in an object
  const lastParent = parents[parents.length - 1];
  let overrideDep: OverrideDependency = overrideBlock;
  for (const parent of parents) {
    if (overrideDep) {
      overrideDep = overrideDep[parent]! as Record<string, RecursiveOverride>;
    }
  }
  const overrideDepName = depName === lastParent ? '.' : depName;
  const depObjectReference = overrideDep as Record<string, string>;
  return { depObjectReference, overrideDepName };
}

function isOverrideObject(upgrade: Upgrade<NpmManagerData>): boolean {
  return (
    is.array(upgrade.managerData?.parents, is.nonEmptyStringAndNotWhitespace) &&
    upgrade.depType === 'overrides'
  );
}
