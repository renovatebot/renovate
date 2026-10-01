import { isEmptyArray, isNonEmptyObject, isString } from '@sindresorhus/is';
import upath from 'upath';
import type { Scalar, YAMLSeq } from 'yaml';
import { isScalar, isSeq, parseDocument } from 'yaml';
import { logger } from '../../../logger/index.ts';
import {
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { regEx } from '../../../util/regex.ts';
import { matchRegexOrGlob } from '../../../util/string-match.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

// eg. 8.15.5+sha256.4b4efa12490e5055d59b9b9fc9438b7d581a6b7af3b5675eb5c5f447cee1a589
const versionWithHashRegString = '^(?<version>.*)\\+(?<hash>.*)';

// Matches a Subresource Integrity string, eg. sha512-<base64 digest>
const sriRegString = '^(?<algo>sha\\d+)-(?<hash>[A-Za-z0-9+/]+={0,2})$';

const packageManagerFieldRegString = '("packageManager"\\s*:\\s*")[^"]*"';

export async function updateArtifacts(
  updateArtifactsConfig: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`npm.updateArtifacts(${updateArtifactsConfig.packageFileName})`);
  let res: UpdateArtifactsResult[] = [];
  res.push(coerceObject(handlePackageManagerUpdates(updateArtifactsConfig)));
  res.push(coerceObject(await updatePnpmWorkspace(updateArtifactsConfig)));

  res = res.filter(isNonEmptyObject);
  if (res.length === 0) {
    return null;
  }

  return res;
}

/**
 * Updates the corepack hash of the `packageManager` field from the new version's integrity digest.
 * @see https://github.com/nodejs/corepack/blob/57bfb67b062ea1b8746b302bcdbf9f8e8438c526/sources/corepackUtils.ts#L300
 */
function handlePackageManagerUpdates(
  updateArtifactsConfig: UpdateArtifact,
): UpdateArtifactsResult | null {
  const { packageFileName, updatedDeps, newPackageFileContent } =
    updateArtifactsConfig;
  const packageManagerUpdate = updatedDeps.find(
    (dep) => dep.depType === 'packageManager',
  );

  if (!packageManagerUpdate) {
    logger.debug('No packageManager updates - returning null');
    return null;
  }

  const { currentValue, depName, newVersion, newDigest } = packageManagerUpdate;

  // Only rewrite the hash if the current value already has one
  if (!currentValue || !regEx(versionWithHashRegString).test(currentValue)) {
    return null;
  }

  const sriMatch = regEx(sriRegString).exec(newDigest ?? '');
  if (!sriMatch?.groups) {
    logger.warn(
      { packageFileName, depName, newVersion, newDigest },
      'Cannot update packageManager hash: no valid digest available',
    );
    return {
      artifactError: {
        fileName: packageFileName,
        stderr: `Cannot update packageManager hash for ${depName}@${newVersion}: no valid digest available`,
      },
    };
  }

  const { algo, hash } = sriMatch.groups;
  const hexHash = Buffer.from(hash, 'base64').toString('hex');
  const newPackageManagerValue = `${depName}@${newVersion}+${algo}.${hexHash}`;

  const newContent = newPackageFileContent.replace(
    regEx(packageManagerFieldRegString),
    `$1${newPackageManagerValue}"`,
  );

  if (newContent === newPackageFileContent) {
    return null;
  }

  logger.debug('Returning updated package.json');
  return {
    file: {
      type: 'addition',
      path: packageFileName,
      contents: newContent,
    },
  };
}

/**
 * Update the minimumReleaseAgeExclude setting in pnpm-workspace.yaml if needed
 */
async function updatePnpmWorkspace(
  updateArtifactsConfig: UpdateArtifact,
): Promise<UpdateArtifactsResult | null> {
  const upgrades = updateArtifactsConfig.updatedDeps.filter(
    (u) => u.isVulnerabilityAlert,
  );
  // return early if no security updates are present
  if (isEmptyArray(upgrades)) {
    return null;
  }

  const pnpmLockFile = upgrades[0].managerData?.pnpmLockFile;
  if (!isString(pnpmLockFile)) {
    logger.debug(
      'No pnpm shrinkwrap found, not attempting to update pnpm-workspace.yaml',
    );
    return null;
  }
  const lockFileDir = upath.dirname(pnpmLockFile);
  const pnpmWorkspaceFilePath = upath.join(lockFileDir, 'pnpm-workspace.yaml');

  if (!(await localPathExists(pnpmWorkspaceFilePath))) {
    return null;
  }

  // use already-updated content when updating the workspace file itself
  const packageFileContent =
    updateArtifactsConfig.packageFileName === pnpmWorkspaceFilePath
      ? updateArtifactsConfig.newPackageFileContent
      : (await readLocalFile(pnpmWorkspaceFilePath, 'utf8'))!;
  const doc = parseDocument(packageFileContent);

  if (!doc.get('minimumReleaseAge')) {
    return null;
  }

  let updated = false;

  for (const upgrade of upgrades) {
    let excludeNode = doc.getIn(['minimumReleaseAgeExclude']) as YAMLSeq | null;
    // v8 ignore next -- TODO: add test #40625
    const newVersion = upgrade.newVersion ?? upgrade.newValue;
    // For pnpm overrides with range selectors (e.g. "pkg@<=1.0.0"), depName contains
    // the full key including the selector. Use packageName (bare package name) for
    // minimumReleaseAgeExclude entries which require exact versions only.
    const excludeDepName = upgrade.packageName ?? upgrade.depName;

    /* v8 ignore if -- should not happen, adding for type narrowing*/
    if (excludeNode && !isSeq(excludeNode)) {
      return null;
    }

    if (!excludeNode) {
      logger.debug('Adding new exclude block');
      excludeNode = doc.createNode([]);
      const newItem = doc.createNode(`${excludeDepName}@${newVersion}`);
      newItem.commentBefore = ` Renovate security update: ${excludeDepName}@${newVersion}`;
      excludeNode.items.push(newItem);
      doc.set('minimumReleaseAgeExclude', excludeNode);
      updated = true;
      continue;
    }

    const {
      item: matchedItem,
      allExcluded,
      malformed,
    } = getMatchedItem(excludeDepName!, excludeNode.items);

    if (allExcluded) {
      // still clean up any malformed entries even when a wildcard covers the package
    } else if (malformed && isScalar<string>(matchedItem)) {
      logger.debug(
        { entry: matchedItem.value, excludeDepName, newVersion },
        'Replacing malformed minimumReleaseAgeExclude entry',
      );
      matchedItem.value = `${excludeDepName}@${newVersion}`;
      matchedItem.commentBefore = ` Renovate security update: ${excludeDepName}@${newVersion}`;
      updated = true;
    } else if (isScalar<string>(matchedItem)) {
      // if we have a comment before the list, which includes the dependency
      if (excludeNode?.commentBefore?.includes(`${excludeDepName}@`)) {
        // and it doesn't already have the version included in it
        if (
          !minimumReleaseAgeExcludeIncludesDepNameAndVersion(
            excludeNode.commentBefore,
            excludeDepName,
            newVersion,
          )
        ) {
          // then append it

          // normalize value (no quote handling needed)
          excludeNode.commentBefore = `${excludeNode.commentBefore} || ${newVersion}`;
          updated = true;
        }
      }
      // otherwise, if it's in our matched item's comment
      else if (matchedItem.commentBefore) {
        // add it
        if (
          !minimumReleaseAgeExcludeIncludesDepNameAndVersion(
            matchedItem.commentBefore,
            excludeDepName,
            newVersion,
          )
        ) {
          // normalize value (no quote handling needed)
          matchedItem.commentBefore = `${matchedItem.commentBefore} || ${newVersion}`;
          updated = true;
        }
      } else {
        matchedItem.commentBefore = ` Renovate security update: ${excludeDepName}@${newVersion}`;
        updated = true;
      }

      if (
        !minimumReleaseAgeExcludeIncludesDepNameAndVersion(
          matchedItem.value,
          excludeDepName,
          newVersion,
        )
      ) {
        matchedItem.value = `${matchedItem.value} || ${newVersion}`;
        updated = true;
      }
    } else {
      // add new entry
      const newItem = doc.createNode(`${excludeDepName}@${newVersion}`);
      newItem.commentBefore = ` Renovate security update: ${excludeDepName}@${newVersion}`;

      excludeNode.items.push(newItem);
      updated = true;
    }

    // Remove any malformed entries for the same package left over from the prior bug
    for (let i = excludeNode.items.length - 1; i >= 0; i--) {
      const item = excludeNode.items[i];
      if (
        item !== matchedItem &&
        isScalar(item) &&
        isString(item.value) &&
        item.value.startsWith(`${excludeDepName}@`) &&
        !isValidMinimumReleaseAgeExcludeEntry(item.value, excludeDepName!)
      ) {
        excludeNode.items.splice(i, 1);
        updated = true;
      }
    }
  }

  if (!updated) {
    return null;
  }

  const newContent = doc.toString();
  await writeLocalFile(pnpmWorkspaceFilePath, newContent);

  return {
    file: {
      type: 'addition',
      path: pnpmWorkspaceFilePath,
      contents: newContent,
    },
  };
}

function getMatchedItem(
  depName: string,
  items: unknown[],
): {
  item: Scalar | null;
  allExcluded: boolean;
  malformed?: boolean;
} {
  let malformedItem: Scalar | null = null;

  for (const item of items) {
    /* v8 ignore if -- should not happen */
    if (!isScalar(item) || !isString(item.value)) {
      continue;
    }

    if (item.value.startsWith(`${depName}@`)) {
      if (isValidMinimumReleaseAgeExcludeEntry(item.value, depName)) {
        return {
          allExcluded: false,
          item,
        };
      }
      malformedItem ??= item;
      continue;
    }

    if (item.value === depName || matchRegexOrGlob(depName, item.value)) {
      return {
        allExcluded: true,
        item,
      };
    }
  }

  if (malformedItem) {
    return {
      allExcluded: false,
      item: malformedItem,
      malformed: true,
    };
  }

  return {
    item: null,
    allExcluded: false,
  };
}

/** pnpm requires package@version entries without range selectors or extra @ in the version part */
function isValidMinimumReleaseAgeExcludeEntry(
  value: string,
  packageName: string,
): boolean {
  return !value.slice(`${packageName}@`.length).includes('@');
}

/** determine whether a comment or a list item contains the depName at a given newVersion */
function minimumReleaseAgeExcludeIncludesDepNameAndVersion(
  line: string,
  depName: string | undefined,
  newVersion: string | undefined,
): boolean {
  if (line.includes(`${depName}@${newVersion}`)) {
    return true;
  }

  if (line.includes(`|| ${newVersion}`)) {
    return true;
  }

  return false;
}
