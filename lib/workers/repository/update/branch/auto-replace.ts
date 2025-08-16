// TODO #22198
import is from '@sindresorhus/is';
import { WORKER_FILE_UPDATE_FAILED } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { extractPackageFile } from '../../../../modules/manager';
import type { PackageDependency } from '../../../../modules/manager/types';
import { writeLocalFile } from '../../../../util/fs';
import { escapeRegExp, regEx } from '../../../../util/regex';
import { matchAt, replaceAt } from '../../../../util/string';
import { compile } from '../../../../util/template';
import type { BranchUpgradeConfig } from '../../../types';

export async function confirmIfDepUpdated(
  upgrade: BranchUpgradeConfig,
  newContent: string,
): Promise<boolean> {
  const { manager, packageFile, depIndex } = upgrade;
  let newUpgrade: PackageDependency;
  try {
    const newExtract = await extractPackageFile(
      manager,
      newContent,
      packageFile!,
      upgrade,
    );
    // istanbul ignore if
    if (!newExtract) {
      // TODO: fix types (#22198)
      logger.debug(
        `Could not extract ${packageFile!} (manager=${manager}) after autoreplace. Did the autoreplace make the file unparseable?`,
      );
      logger.trace(
        { packageFile, content: newContent },
        'packageFile content after autoreplace',
      );
      return false;
    }
    // istanbul ignore if
    if (!newExtract.deps?.length) {
      logger.debug(
        `Extracted ${packageFile!} after autoreplace has no deps array. Did the autoreplace make the file unparseable?`,
      );
      return false;
    }
    // istanbul ignore if
    if (is.number(depIndex) && depIndex >= newExtract.deps.length) {
      logger.debug(
        `Extracted ${packageFile!} after autoreplace has fewer deps than expected.`,
      );
      return false;
    }
    newUpgrade = newExtract.deps[depIndex!];
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ manager, packageFile, err }, 'Failed to parse newContent');
  }

  if (!newUpgrade!) {
    logger.debug(`No newUpgrade in ${packageFile!}`);
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
      'depName mismatch',
    );
    return false;
  }

  if (upgrade.newName && upgrade.newName !== newUpgrade.depName) {
    logger.debug(
      {
        manager,
        packageFile,
        currentDepName: upgrade.depName,
        newDepName: newUpgrade.depName,
      },
      'depName is not updated',
    );
    return false;
  }

  if (upgrade.newValue && upgrade.newValue !== newUpgrade.currentValue) {
    logger.debug(
      {
        depName: upgrade.depName,
        manager,
        packageFile,
        expectedValue: upgrade.newValue,
        foundValue: newUpgrade.currentValue,
      },
      'Value is not updated',
    );
    return false;
  }

  if (
    upgrade.newDigest &&
    (upgrade.isPinDigest === true || upgrade.currentDigest) &&
    upgrade.newDigest !== newUpgrade.currentDigest
  ) {
    logger.debug(
      {
        depName: upgrade.depName,
        manager,
        packageFile,
        expectedValue: upgrade.newDigest,
        foundValue: newUpgrade.currentDigest,
      },
      'Digest is not updated',
    );
    return false;
  }

  return true;
}

function getDepsSignature(deps: PackageDependency[]): string {
  // TODO: types (#22198)
  return deps
    .map(
      (dep) =>
        `${(dep.depName ?? dep.packageName)!}${(dep.packageName ??
          dep.depName)!}`,
    )
    .join(',');
}

function firstIndexOf(
  existingContent: string,
  depName: string,
  currentValue: string,
  position = 0,
): number {
  const depIndex = existingContent.indexOf(depName, position);
  const valIndex = existingContent.indexOf(currentValue, position);
  const index = depIndex < valIndex ? depIndex : valIndex;
  if (index < 0) {
    return position === 0 ? -1 : existingContent.length;
  }
  return index;
}

export async function checkBranchDepsMatchBaseDeps(
  upgrade: BranchUpgradeConfig,
  branchContent: string,
): Promise<boolean> {
  const { baseDeps, manager, packageFile } = upgrade;
  try {
    const res = await extractPackageFile(
      manager,
      branchContent,
      packageFile!,
      upgrade,
    )!;
    const branchDeps = res!.deps;
    return getDepsSignature(baseDeps!) === getDepsSignature(branchDeps);
  } catch /* istanbul ignore next */ {
    logger.info(
      { manager, packageFile },
      'Failed to parse branchContent - rebasing',
    );
    return false;
  }
}

async function checkExistingBranch(
  upgrade: BranchUpgradeConfig,
  existingContent: string,
): Promise<string | null> {
  const { packageFile, depName } = upgrade;
  if (!(await checkBranchDepsMatchBaseDeps(upgrade, existingContent))) {
    logger.debug(
      { packageFile, depName },
      'Rebasing branch after deps list has changed',
    );
    return null;
  }
  if (!(await confirmIfDepUpdated(upgrade, existingContent))) {
    logger.debug(
      { packageFile, depName },
      'Rebasing after outdated branch dep found',
    );
    return null;
  }
  // TODO: fix types (#22198)
  logger.debug(`Branch dep ${depName!} in ${packageFile!} is already updated`);
  return existingContent;
}

export async function doAutoReplace(
  upgrade: BranchUpgradeConfig,
  existingContent: string,
  reuseExistingBranch: boolean,
  firstUpdate = true,
): Promise<string | null> {
  const {
    packageFile,
    depName,
    depNameTemplate,
    newName,
    currentValue,
    currentValueTemplate,
    newValue,
    currentDigest,
    currentDigestShort,
    newDigest,
    autoReplaceGlobalMatch,
    autoReplaceStringTemplate,
  } = upgrade;
  /*
    If replacement support for more managers is added,
    please also update the list in docs/usage/configuration-options.md
    at replacementName and replacementVersion
  */
  if (reuseExistingBranch) {
    return await checkExistingBranch(upgrade, existingContent);
  }
  const replaceWithoutReplaceString =
    is.string(newName) &&
    newName !== depName &&
    (is.undefined(upgrade.replaceString) ||
      !upgrade.replaceString?.includes(depName!));
  const replaceString = upgrade.replaceString ?? currentValue ?? currentDigest;
  logger.trace({ depName, replaceString }, 'autoReplace replaceString');
  let searchIndex: number;
  if (replaceWithoutReplaceString) {
    searchIndex = firstIndexOf(existingContent, depName!, currentValue!);
  } else {
    searchIndex = existingContent.indexOf(replaceString!);
  }
  if (searchIndex === -1) {
    logger.info(
      { packageFile, depName, existingContent, replaceString },
      'Cannot find replaceString in current file content. Was it already updated?',
    );
    return existingContent;
  }
  try {
    let newString: string;
    if (autoReplaceStringTemplate && !newName) {
      newString = compile(autoReplaceStringTemplate, upgrade, false);
    } else {
      newString = replaceString!;

      const autoReplaceRegExpFlag = autoReplaceGlobalMatch ? 'g' : '';
      if (currentValue && newValue && currentValue !== newValue) {
        if (!newString.includes(currentValue)) {
          logger.debug(
            { stringToReplace: newString, currentValue, currentValueTemplate },
            'currentValue not found in string to replace',
          );
        }
        newString = newString.replace(
          regEx(escapeRegExp(currentValue), autoReplaceRegExpFlag),
          newValue,
        );
      }
      if (depName && newName && depName !== newName) {
        if (!newString.includes(depName)) {
          logger.debug(
            { stringToReplace: newString, depName, depNameTemplate },
            'depName not found in string to replace',
          );
        }
        newString = newString.replace(
          regEx(escapeRegExp(depName), autoReplaceRegExpFlag),
          newName,
        );
      }
      if (currentDigest && newDigest && currentDigest !== newDigest) {
        if (!newString.includes(currentDigest)) {
          logger.debug(
            { stringToReplace: newString, currentDigest },
            'currentDigest not found in string to replace',
          );
        }
        newString = newString.replace(
          regEx(escapeRegExp(currentDigest), autoReplaceRegExpFlag),
          newDigest,
        );
      } else if (
        currentDigestShort &&
        newDigest &&
        currentDigestShort !== newDigest
      ) {
        if (!newString.includes(currentDigestShort)) {
          logger.debug(
            { stringToReplace: newString, currentDigestShort },
            'currentDigestShort not found in string to replace',
          );
        }
        newString = newString.replace(
          regEx(escapeRegExp(currentDigestShort), autoReplaceRegExpFlag),
          newDigest,
        );
      }
    }
    if (!firstUpdate && (await confirmIfDepUpdated(upgrade, existingContent))) {
      logger.debug(
        { packageFile, depName },
        'Package file is already updated - no work to do',
      );
      return existingContent;
    }
    logger.debug(
      { packageFile, depName },
      `Starting search at index ${searchIndex}`,
    );
    let newContent = existingContent;
    let nameReplaced = !newName;
    let valueReplaced = !newValue;
    let digestReplaced = !newDigest;
    let startIndex = searchIndex;
    // Iterate through the rest of the file
    for (; searchIndex < newContent.length; searchIndex += 1) {
      // First check if we have a hit for the old version
      if (replaceWithoutReplaceString) {
        // look for depName and currentValue
        if (newName && matchAt(newContent, searchIndex, depName!)) {
          logger.debug(
            { packageFile, depName },
            `Found depName at index ${searchIndex}`,
          );
          if (nameReplaced) {
            startIndex = firstIndexOf(
              existingContent,
              depName!,
              currentValue!,
              startIndex + 1,
            );
            searchIndex = startIndex - 1;
            await writeLocalFile(upgrade.packageFile!, existingContent);
            newContent = existingContent;
            nameReplaced = !newName;
            valueReplaced = !newValue;
            digestReplaced = !newDigest;
            continue;
          }
          // replace with newName
          newContent = replaceAt(newContent, searchIndex, depName!, newName);
          await writeLocalFile(upgrade.packageFile!, newContent);
          nameReplaced = true;
          searchIndex += newName.length - 1;
        } else if (
          newValue &&
          matchAt(newContent, searchIndex, currentValue!)
        ) {
          logger.debug(
            { packageFile, currentValue },
            `Found currentValue at index ${searchIndex}`,
          );
          if (valueReplaced) {
            startIndex = firstIndexOf(
              existingContent,
              depName!,
              currentValue!,
              startIndex + 1,
            );
            searchIndex = startIndex - 1;
            await writeLocalFile(upgrade.packageFile!, existingContent);
            newContent = existingContent;
            nameReplaced = !newName;
            valueReplaced = !newValue;
            digestReplaced = !newDigest;
            continue;
          }
          // Now test if the result matches
          newContent = replaceAt(
            newContent,
            searchIndex,
            currentValue!,
            newValue,
          );
          await writeLocalFile(upgrade.packageFile!, newContent);
          valueReplaced = true;
          searchIndex += newValue.length - 1;
        } else if (
          newDigest &&
          matchAt(newContent, searchIndex, currentDigest!)
        ) {
          logger.debug(
            { packageFile, currentDigest },
            `Found currentDigest at index ${searchIndex}`,
          );
          if (digestReplaced) {
            startIndex = firstIndexOf(
              existingContent,
              depName!,
              currentValue!,
              startIndex + 1,
            );
            searchIndex = startIndex - 1;
            await writeLocalFile(upgrade.packageFile!, existingContent);
            newContent = existingContent;
            nameReplaced = !newName;
            valueReplaced = !newValue;
            digestReplaced = !newDigest;
            continue;
          }
          // Now test if the result matches
          newContent = replaceAt(
            newContent,
            searchIndex,
            currentDigest!,
            newDigest,
          );
          await writeLocalFile(upgrade.packageFile!, newContent);
          digestReplaced = true;
          searchIndex += newDigest.length - 1;
        }
        if (nameReplaced && valueReplaced && digestReplaced) {
          if (await confirmIfDepUpdated(upgrade, newContent)) {
            return newContent;
          }
          startIndex = firstIndexOf(
            existingContent,
            depName!,
            currentValue!,
            startIndex + 1,
          );
          searchIndex = startIndex - 1;
          await writeLocalFile(upgrade.packageFile!, existingContent);
          newContent = existingContent;
          nameReplaced = !newName;
          valueReplaced = !newValue;
          digestReplaced = !newDigest;
        }
      } else if (matchAt(newContent, searchIndex, replaceString!)) {
        logger.debug(
          { packageFile, depName },
          `Found match at index ${searchIndex}`,
        );
        // Now test if the result matches
        newContent = replaceAt(
          newContent,
          searchIndex,
          replaceString!,
          newString,
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
