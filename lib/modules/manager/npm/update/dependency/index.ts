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
import { getNewGitValue, getNewNpmAliasValue } from './common';
import { updatePnpmCatalogDependency } from './pnpm';
import { parseSingleYaml } from '../../../../../util/yaml';

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

function getStrValue(isYaml: boolean, text: string): string {
  if (!isYaml) {
    return `"${text}"`;
  }
  const simpleString = new RegExp(/^[a-z0-9]/i).exec(text);
  if (simpleString) {
    return text;
  } else {
    return `"${text}"`;
  }
}

function replaceAsString(
  parsedContents: NpmPackage,
  fileContent: string,
  depType:
    | NpmDepType
    | 'dependenciesMeta'
    | 'packageManager'
    | 'pnpm.overrides',
  depName: string,
  oldValue: string,
  newValue: string,
  isYaml: boolean,
  parents?: string[],
): string {
  if (depType === 'packageManager') {
    parsedContents[depType] = newValue;
  } else if (depType === 'pnpm.overrides') {
    parsedContents.pnpm!.overrides![depName] = newValue;
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
  const searchString = getStrValue(isYaml, oldValue);
  let newString = getStrValue(isYaml, newValue);

  const escapedDepName = escapeRegExp(depName);
  const patchRe = regEx(`^(patch:${escapedDepName}@(npm:)?).*#`);
  const match = patchRe.exec(oldValue);
  if (match && depType === 'resolutions') {
    const patch = oldValue.replace(match[0], `${match[1]}${newValue}#`);
    parsedContents[depType]![depName] = patch;
    newString = getStrValue(isYaml, patch);
  }

  // Skip ahead to depType section
  let searchIndex =
    fileContent.indexOf(isYaml ? depType : `"${depType}"`) + depType.length;
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
      if (
        dequal(
          parsedContents,
          isYaml ? parseSingleYaml(testContent) : JSON.parse(testContent),
        )
      ) {
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
  if (upgrade.depType?.startsWith('pnpm.catalog')) {
    return updatePnpmCatalogDependency({ fileContent, upgrade });
  }

  const { depType, managerData } = upgrade;
  const depName: string = managerData?.key ?? upgrade.depName;
  let { newValue } = upgrade;

  newValue = getNewGitValue(upgrade) ?? newValue;
  newValue = getNewNpmAliasValue(newValue, upgrade) ?? newValue;

  logger.debug(`npm.updateDependency(): ${depType}.${depName} = ${newValue}`);

  let isYaml = false;
  try {
    let parsedContents: NpmPackage;
    try {
      parsedContents = JSON.parse(fileContent);
    } catch (error) {
      try {
        parsedContents = parseSingleYaml(fileContent);
        isYaml = true;
      } catch (err) {
        throw error;
      }
    }
    let overrideDepParents: string[] | undefined = undefined;
    // Save the old version
    let oldVersion: string | undefined;
    if (depType === 'packageManager') {
      oldVersion = parsedContents[depType];
      newValue = `${depName}@${newValue}`;
    } else if (isOverrideObject(upgrade)) {
      overrideDepParents = managerData?.parents;
      if (overrideDepParents) {
        // old version when there is an object as a value in overrides block
        const { depObjectReference, overrideDepName } = overrideDepPosition(
          parsedContents.overrides!,
          overrideDepParents,
          depName,
        );
        if (depObjectReference) {
          oldVersion = depObjectReference[overrideDepName]!;
        }
      }
    } else if (depType === 'pnpm.overrides') {
      oldVersion = parsedContents.pnpm?.overrides?.[depName];
    } else {
      oldVersion = parsedContents[depType as NpmDepType]![depName] as string;
    }
    if (oldVersion === newValue) {
      logger.trace('Version is already updated');
      return fileContent;
    }

    // TODO #22198
    let newFileContent: string;
    if (upgrade.newName && upgrade.replacementApproach === 'alias') {
      newFileContent = replaceAsString(
        parsedContents,
        fileContent,
        depType as NpmDepType,
        depName,
        oldVersion!,
        `npm:${upgrade.newName}@${newValue}`,
        isYaml,
        overrideDepParents,
      );
    } else {
      newFileContent = replaceAsString(
        parsedContents,
        fileContent,
        depType as NpmDepType,
        depName,
        oldVersion!,
        newValue!,
        isYaml,
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
          isYaml,
          overrideDepParents,
        );
      }
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
          isYaml,
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
            isYaml,
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
            isYaml,
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
      overrideDep = overrideDep[parent] as Record<string, RecursiveOverride>;
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
