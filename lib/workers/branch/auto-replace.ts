import { logger } from '../../logger';
import { get } from '../../manager';
import { WORKER_FILE_UPDATE_FAILED } from '../../constants/error-messages';
import { matchAt, replaceAt } from '../../util/string';

export async function confirmIfDepUpdated(
  upgrade,
  newContent: string
): Promise<boolean> {
  const {
    manager,
    packageFile,
    newValue,
    newDigest,
    autoReplaceData,
  } = upgrade;
  const extractPackageFile = get(manager, 'extractPackageFile');
  let newUpgrade;
  try {
    const newExtract = await extractPackageFile(
      newContent,
      packageFile,
      upgrade
    );
    newUpgrade = newExtract.deps[autoReplaceData.depIndex];
  } catch (err) /* istanbul ignore next */ {
    logger.debug('Failed to parse newContent');
  }
  if (
    newUpgrade &&
    newUpgrade.currentValue === newValue &&
    newUpgrade.currentDigest === newDigest
  ) {
    return true;
  }
  return false;
}

function getDepsSignature(deps): string {
  return deps.map(dep => `${dep.depName}${dep.lookupName}`).join(',');
}

export async function checkBranchDepsMatchBaseDeps(
  upgrade,
  branchContent
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
    logger.warn('Failed to parse branchContent');
    return false;
  }
}

export async function doAutoReplace(
  upgrade,
  existingContent: string,
  parentBranch: string | null
): Promise<string | null> {
  if (parentBranch) {
    if (!(await checkBranchDepsMatchBaseDeps(upgrade, existingContent))) {
      logger.debug('Rebasing branch after deps list has changed');
      return null;
    }
    if (!(await confirmIfDepUpdated(upgrade, existingContent))) {
      logger.debug('Rebasing after outdated branch dep found');
      return null;
    }
    logger.debug('Branch dep is already updated');
    return existingContent;
  }
  const {
    currentValue,
    newValue,
    currentDigest,
    newDigest,
    autoReplaceData,
  } = upgrade;
  const { replaceString } = autoReplaceData;
  try {
    let newString = replaceString;
    do {
      newString = newString.replace(currentValue, newValue);
    } while (newString.includes(currentValue));
    if (currentDigest) {
      do {
        newString = newString.replace(currentDigest, newDigest);
      } while (newString.includes(currentDigest));
    }
    let searchIndex = existingContent.indexOf(replaceString);
    if (searchIndex === -1) {
      logger.error('Cannot find replaceString in current file content');
      throw new Error(WORKER_FILE_UPDATE_FAILED);
    }
    logger.debug(`Starting search at index ${searchIndex}`);
    // Iterate through the rest of the file
    for (; searchIndex < existingContent.length; searchIndex += 1) {
      // First check if we have a hit for the old version
      if (matchAt(existingContent, searchIndex, replaceString)) {
        logger.debug(`Found match at index ${searchIndex}`);
        // Now test if the result matches
        const testContent = replaceAt(
          existingContent,
          searchIndex,
          replaceString,
          newString
        );
        if (await confirmIfDepUpdated(upgrade, testContent)) {
          return testContent;
        }
      }
    }
  } catch (err) {
    logger.debug({ err }, 'doAutoReplace error');
  }
  logger.error('Could not autoReplace');
  throw new Error(WORKER_FILE_UPDATE_FAILED);
}
