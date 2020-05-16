import { WORKER_FILE_UPDATE_FAILED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { get } from '../../manager';
import { PackageDependency } from '../../manager/common';
import { writeLocalFile } from '../../util/fs';
import { escapeRegExp, regEx } from '../../util/regex';
import { matchAt, replaceAt } from '../../util/string';
import { compile } from '../../util/template';
import { BranchUpgradeConfig } from '../common';

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
  let newUpgrade;
  try {
    const newExtract = await extractPackageFile(
      newContent,
      packageFile,
      upgrade
    );
    newUpgrade = newExtract.deps[depIndex];
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ manager, packageFile }, 'Failed to parse newContent');
  }
  if (!newUpgrade) {
    logger.debug({ manager, packageFile }, 'No newUpgrade');
    return false;
  }
  // istanbul ignore if
  if (upgrade.depName !== newUpgrade.depName) {
    logger.debug(
      {
        manager,
        packageFile,
        currentDepName: upgrade.depName,
        newDepName: newUpgrade.depName,
      },
      'depName mismatch'
    );
  }
  if (newUpgrade.currentValue !== newValue) {
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
  return deps.map((dep) => `${dep.depName}${dep.lookupName}`).join(',');
}

export async function checkBranchDepsMatchBaseDeps(
  upgrade: BranchUpgradeConfig,
  branchContent: string
): Promise<boolean> {
  const { baseDeps, manager, packageFile } = upgrade;
  const extractPackageFile = get(manager, 'extractPackageFile');
  try {
    const { deps: branchDeps } = await extractPackageFile(
      branchContent,
      packageFile,
      upgrade
    );
    return getDepsSignature(baseDeps) === getDepsSignature(branchDeps);
  } catch (err) /* istanbul ignore next */ {
    logger.info(
      { manager, packageFile },
      'Failed to parse branchContent - rebasing'
    );
    return false;
  }
}

export async function doAutoReplace(
  upgrade: BranchUpgradeConfig,
  existingContent: string,
  reuseExistingBranch: boolean
): Promise<string | null> {
  const {
    packageFile,
    depName,
    currentValue,
    newValue,
    currentDigest,
    newDigest,
    autoReplaceStringTemplate,
  } = upgrade;
  if (reuseExistingBranch) {
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
  const replaceString = upgrade.replaceString || currentValue;
  logger.trace({ depName, replaceString }, 'autoReplace replaceString');
  let searchIndex = existingContent.indexOf(replaceString);
  if (searchIndex === -1) {
    logger.warn(
      { packageFile, depName, existingContent, replaceString },
      'Cannot find replaceString in current file content'
    );
    return existingContent;
  }
  try {
    let newString: string;
    if (autoReplaceStringTemplate) {
      newString = compile(autoReplaceStringTemplate, upgrade, false);
    } else {
      newString = replaceString;
      if (currentValue) {
        newString = newString.replace(
          regEx(escapeRegExp(currentValue), 'g'),
          newValue
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
    // Iterate through the rest of the file
    for (; searchIndex < existingContent.length; searchIndex += 1) {
      // First check if we have a hit for the old version
      if (matchAt(existingContent, searchIndex, replaceString)) {
        logger.debug(
          { packageFile, depName },
          `Found match at index ${searchIndex}`
        );
        // Now test if the result matches
        const testContent = replaceAt(
          existingContent,
          searchIndex,
          replaceString,
          newString
        );
        await writeLocalFile(upgrade.packageFile, testContent);
        if (await confirmIfDepUpdated(upgrade, testContent)) {
          return testContent;
        }
        // istanbul ignore next
        await writeLocalFile(upgrade.packageFile, existingContent);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ packageFile, depName, err }, 'doAutoReplace error');
  }
  // istanbul ignore next
  throw new Error(WORKER_FILE_UPDATE_FAILED);
}
