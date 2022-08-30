// TODO #7154
import { WORKER_FILE_UPDATE_FAILED } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { get } from '../../../../modules/manager';
import type { PackageDependency } from '../../../../modules/manager/types';
import { writeLocalFile } from '../../../../util/fs';
import { escapeRegExp, regEx } from '../../../../util/regex';
import { matchAt, replaceAt } from '../../../../util/string';
import { compile } from '../../../../util/template';
import type { BranchUpgradeConfig } from '../../../types';

export async function confirmIfDepUpdated(
  upgrade: BranchUpgradeConfig,
  newContent: string
): Promise<boolean> {
  const {
    manager,
    packageFile,
    newValue,
    newDigest,
    depIndex,
    currentDigest,
    pinDigests,
  } = upgrade;
  const extractPackageFile = get(manager, 'extractPackageFile');
  let newUpgrade: PackageDependency;
  try {
    const newExtract = await extractPackageFile!(
      newContent,
      packageFile,
      upgrade
    );
    // istanbul ignore if
    if (!newExtract) {
      logger.debug({ manager, packageFile }, 'Could not extract package file');
      return false;
    }
    newUpgrade = newExtract.deps[depIndex!];
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ manager, packageFile, err }, 'Failed to parse newContent');
  }
  if (!newUpgrade!) {
    logger.debug({ manager, packageFile }, 'No newUpgrade');
    return false;
  }

  if (
    upgrade.depName !== newUpgrade.depName &&
    upgrade.newName !== newUpgrade.depName
  ) {
    logger.debug(
      {
        manager,
        packageFile,
        currentDepName: upgrade.depName,
        newDepName: newUpgrade.depName,
      },
      'depName mismatch'
    );
    return false;
  }
  if (newValue && newUpgrade.currentValue !== newValue) {
    logger.debug(
      {
        manager,
        packageFile,
        expectedValue: newValue,
        foundValue: newUpgrade.currentValue,
      },
      'Value mismatch'
    );
    return false;
  }
  if (!newDigest) {
    return true;
  }
  if (newUpgrade.currentDigest === newDigest) {
    return true;
  }
  if (!currentDigest && !pinDigests) {
    return true;
  }
  // istanbul ignore next
  return false;
}

function getDepsSignature(deps: PackageDependency[]): string {
  // TODO: types (#7154)
  return deps.map((dep) => `${dep.depName!}${dep.packageName!}`).join(',');
}

export async function checkBranchDepsMatchBaseDeps(
  upgrade: BranchUpgradeConfig,
  branchContent: string
): Promise<boolean> {
  const { baseDeps, manager, packageFile } = upgrade;
  const extractPackageFile = get(manager, 'extractPackageFile');
  try {
    const res = await extractPackageFile!(branchContent, packageFile, upgrade)!;
    const branchDeps = res!.deps;
    return getDepsSignature(baseDeps!) === getDepsSignature(branchDeps);
  } catch (err) /* istanbul ignore next */ {
    logger.info(
      { manager, packageFile },
      'Failed to parse branchContent - rebasing'
    );
    return false;
  }
}

async function checkExistingBranch(
  upgrade: BranchUpgradeConfig,
  existingContent: string
): Promise<string | null> {
  const { packageFile, depName } = upgrade;
  if (!(await checkBranchDepsMatchBaseDeps(upgrade, existingContent))) {
    logger.debug(
      { packageFile, depName },
      'Rebasing branch after deps list has changed'
    );
    return null;
  }
  if (!(await confirmIfDepUpdated(upgrade, existingContent))) {
    logger.debug(
      { packageFile, depName },
      'Rebasing after outdated branch dep found'
    );
    return null;
  }
  logger.debug({ packageFile, depName }, 'Branch dep is already updated');
  return existingContent;
}

/**
 * Handles version upgrades for managers which do not already have custom logic
 * @param upgrade
 * @param existingContent
 * @param reuseExistingBranch
 * @returns
 */
export async function doAutoReplace(
  upgrade: BranchUpgradeConfig,
  existingContent: string,
  reuseExistingBranch: boolean
): Promise<string | null> {
  const {
    packageFile,
    depName,
    newName,
    currentValue,
    newValue,
    currentDigest,
    newDigest,
    autoReplaceStringTemplate,
  } = upgrade;
  if (reuseExistingBranch) {
    return await checkExistingBranch(upgrade, existingContent);
  }
  const replaceWithoutReplaceString = Boolean(
    newName &&
      newName !== depName &&
      (!upgrade.replaceString ||
        upgrade.replaceString?.indexOf(depName!) === -1)
  );
  const replaceString = upgrade.replaceString ?? currentValue;
  logger.trace({ depName, replaceString }, 'autoReplace replaceString');
  let searchIndex;
  if (replaceWithoutReplaceString) {
    const depIndex = existingContent.indexOf(depName!);
    const valIndex = existingContent.indexOf(currentValue!);
    searchIndex = depIndex < valIndex ? depIndex : valIndex;
  } else {
    searchIndex = existingContent.indexOf(replaceString!);
  }
  if (searchIndex === -1) {
    logger.info(
      { packageFile, depName, existingContent, replaceString },
      'Cannot find replaceString in current file content. Was it already updated?'
    );
    return existingContent;
  }
  try {
    let newString: string;
    if (autoReplaceStringTemplate && !newName) {
      newString = compile(autoReplaceStringTemplate, upgrade, false);
    } else {
      newString = replaceString!;
      if (currentValue && newValue) {
        newString = newString.replace(
          regEx(escapeRegExp(currentValue), 'g'),
          newValue
        );
      }
      if (depName && newName) {
        newString = newString.replace(
          regEx(escapeRegExp(depName), 'g'),
          newName
        );
      }
      if (currentDigest && newDigest) {
        newString = newString.replace(
          regEx(escapeRegExp(currentDigest), 'g'),
          newDigest
        );
      }
    }
    logger.debug(
      { packageFile, depName },
      `Starting search at index ${searchIndex}`
    );
    let newContent = existingContent;
    let nameReplaced = !newName;
    let valueReplaced = !newValue;
    // Iterate through the rest of the file
    for (; searchIndex < newContent.length; searchIndex += 1) {
      // First check if we have a hit for the old version
      if (replaceWithoutReplaceString) {
        // look for depName and currentValue
        if (newName && matchAt(newContent, searchIndex, depName!)) {
          logger.debug(
            { packageFile, depName },
            `Found depName at index ${searchIndex}`
          );
          // replace with newName
          newContent = replaceAt(newContent, searchIndex, depName!, newName);
          await writeLocalFile(upgrade.packageFile!, newContent);
          nameReplaced = true;
        } else if (
          newValue &&
          matchAt(newContent, searchIndex, currentValue!)
        ) {
          logger.debug(
            { packageFile, currentValue },
            `Found currentValue at index ${searchIndex}`
          );
          // Now test if the result matches
          newContent = replaceAt(
            newContent,
            searchIndex,
            currentValue!,
            newValue
          );
          await writeLocalFile(upgrade.packageFile!, newContent);
          valueReplaced = true;
        } else if (nameReplaced && valueReplaced) {
          if (await confirmIfDepUpdated(upgrade, newContent)) {
            return newContent;
          }
          await writeLocalFile(upgrade.packageFile!, existingContent);
          newContent = existingContent;
          nameReplaced = false;
          valueReplaced = false;
        }
      } else if (matchAt(newContent, searchIndex, replaceString!)) {
        logger.debug(
          { packageFile, depName },
          `Found match at index ${searchIndex}`
        );
        // Now test if the result matches
        newContent = replaceAt(
          newContent,
          searchIndex,
          replaceString!,
          newString
        );
        await writeLocalFile(upgrade.packageFile!, newContent);
        if (await confirmIfDepUpdated(upgrade, newContent)) {
          return newContent;
        }
        await writeLocalFile(upgrade.packageFile!, existingContent);
        newContent = existingContent;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ packageFile, depName, err }, 'doAutoReplace error');
  }
  // istanbul ignore next
  throw new Error(WORKER_FILE_UPDATE_FAILED);
}
