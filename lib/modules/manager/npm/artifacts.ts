import { isEmptyArray, isNonEmptyObject, isString } from '@sindresorhus/is';
import upath from 'upath';
import type { Scalar, YAMLSeq } from 'yaml';
import { isScalar, isSeq, parseDocument } from 'yaml';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  ensureCacheDir,
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { matchRegexOrGlob } from '../../../util/string-match.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { PNPM_CACHE_DIR, PNPM_STORE_DIR } from './constants.ts';
import { getNodeToolConstraint } from './post-update/node-version.ts';
import { processHostRules } from './post-update/rules.ts';
import { lazyLoadPackageJson } from './post-update/utils.ts';
import {
  getNpmrcContent,
  resetNpmrcContent,
  updateNpmrcContent,
} from './utils.ts';

// eg. 8.15.5+sha256.4b4efa12490e5055d59b9b9fc9438b7d581a6b7af3b5675eb5c5f447cee1a589
const versionWithHashRegString = '^(?<version>.*)\\+(?<hash>.*)';

// Execute 'corepack use' command for npm manager updates
// This step is necessary because Corepack recommends attaching a hash after the version
// The hash is generated only after running 'corepack use' and cannot be fetched from the npm registry
export async function updateArtifacts(
  updateArtifactsConfig: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`npm.updateArtifacts(${updateArtifactsConfig.packageFileName})`);
  let res: UpdateArtifactsResult[] = [];
  res.push((await handlePackageManagerUpdates(updateArtifactsConfig)) ?? {});
  res.push((await updatePnpmWorkspace(updateArtifactsConfig)) ?? {});

  res = res.filter(isNonEmptyObject);
  if (res.length === 0) {
    return null;
  }

  return res;
}

async function handlePackageManagerUpdates(
  updateArtifactsConfig: UpdateArtifact,
): Promise<UpdateArtifactsResult | null> {
  const {
    packageFileName,
    config,
    updatedDeps,
    newPackageFileContent: existingPackageFileContent,
  } = updateArtifactsConfig;
  const packageManagerUpdate = updatedDeps.find(
    (dep) => dep.depType === 'packageManager',
  );

  if (!packageManagerUpdate) {
    logger.debug('No packageManager updates - returning null');
    return null;
  }

  const { currentValue, depName, newVersion } = packageManagerUpdate;

  // Execute 'corepack use' command only if the currentValue already has hash in it
  if (!currentValue || !regEx(versionWithHashRegString).test(currentValue)) {
    return null;
  }

  // write old updates before executing corepack update so that they are not removed from package file
  await writeLocalFile(packageFileName, existingPackageFileContent);

  // Asumming that corepack only needs to modify the package.json file in the root folder
  // As it should not be regular practice to have different package managers in different workspaces
  const pkgFileDir = upath.dirname(packageFileName);
  const { additionalNpmrcContent } = processHostRules();
  const npmrcContent = await getNpmrcContent(pkgFileDir);
  const lazyPkgJson = lazyLoadPackageJson(pkgFileDir);
  const cmd = `corepack use ${depName}@${newVersion}`;

  const nodeConstraints = await getNodeToolConstraint(
    config,
    updatedDeps,
    pkgFileDir,
    lazyPkgJson,
  );

  const pnpmConfigCacheDir = await ensureCacheDir(PNPM_CACHE_DIR);
  const pnpmConfigStoreDir = await ensureCacheDir(PNPM_STORE_DIR);
  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    extraEnv: {
      // To make sure pnpm store location is consistent between "corepack use"
      // here and the pnpm commands in ./post-update/pnpm.ts. Check
      // ./post-update/pnpm.ts for more details.
      npm_config_cache_dir: pnpmConfigCacheDir,
      npm_config_store_dir: pnpmConfigStoreDir,
      pnpm_config_cache_dir: pnpmConfigCacheDir,
      pnpm_config_store_dir: pnpmConfigStoreDir,
    },
    toolConstraints: [
      nodeConstraints,
      {
        toolName: 'corepack',
        constraint: config.constraints?.corepack,
      },
    ],
    docker: {},
  };

  await updateNpmrcContent(pkgFileDir, npmrcContent, additionalNpmrcContent);
  try {
    await exec(cmd, execOptions);
    await resetNpmrcContent(pkgFileDir, npmrcContent);
    const newPackageFileContent = await readLocalFile(packageFileName, 'utf8');
    if (
      !newPackageFileContent ||
      existingPackageFileContent === newPackageFileContent
    ) {
      return null;
    }
    logger.debug('Returning updated package.json');
    return {
      file: {
        type: 'addition',
        path: packageFileName,
        contents: newPackageFileContent,
      },
    };
  } catch (err) {
    logger.warn({ err }, 'Error updating package.json');
    await resetNpmrcContent(pkgFileDir, npmrcContent);
    return {
      artifactError: {
        fileName: packageFileName,
        stderr: err.message,
      },
    };
  }
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

  const pnpmShrinkwrap = upgrades[0].managerData?.pnpmShrinkwrap;
  if (!isString(pnpmShrinkwrap)) {
    logger.debug(
      'No pnpm shrinkwrap found, not attempting to update pnpm-workspace.yaml',
    );
    return null;
  }
  const lockFileDir = upath.dirname(pnpmShrinkwrap);
  const pnpmWorkspaceFilePath = upath.join(lockFileDir, 'pnpm-workspace.yaml');

  if (!(await localPathExists(pnpmWorkspaceFilePath))) {
    return null;
  }

  const packageFileContent = (await readLocalFile(
    pnpmWorkspaceFilePath,
    'utf8',
  ))!;
  const doc = parseDocument(packageFileContent);

  if (!doc.get('minimumReleaseAge')) {
    return null;
  }

  let updated = false;

  for (const upgrade of upgrades) {
    let excludeNode = doc.getIn(['minimumReleaseAgeExclude']) as YAMLSeq | null;
    const newVersion = upgrade.newVersion ?? upgrade.newValue;

    /* v8 ignore if -- should not happen, adding for type narrowing*/
    if (excludeNode && !isSeq(excludeNode)) {
      return null;
    }

    if (!excludeNode) {
      logger.debug('Adding new exclude block');
      excludeNode = doc.createNode([]) as YAMLSeq;
      const newItem = doc.createNode(`${upgrade.depName}@${newVersion}`);
      newItem.commentBefore = ` Renovate security update: ${upgrade.depName}@${newVersion}`;
      excludeNode.items.push(newItem);
      doc.set('minimumReleaseAgeExclude', excludeNode);
      updated = true;
      continue;
    }

    const { item: matchedItem, allExcluded } = getMatchedItem(
      upgrade.depName!,
      excludeNode.items,
    );

    if (allExcluded) {
      continue;
    }

    if (isScalar<string>(matchedItem)) {
      // if we have a comment before the list, which includes the dependency
      if (excludeNode?.commentBefore?.includes(`${upgrade.depName}@`)) {
        // and it doesn't already have the version included in it
        if (
          !minimumReleaseAgeExcludeIncludesDepNameAndVersion(
            excludeNode.commentBefore,
            upgrade.depName,
            newVersion,
          )
        ) {
          // then append it

          // normalize value (no quote handling needed)
          excludeNode.commentBefore =
            excludeNode.commentBefore + ` || ${newVersion}`;
          updated = true;
        }
      }
      // otherwise, if it's in our matched item's comment
      else if (matchedItem.commentBefore) {
        // add it
        if (
          !minimumReleaseAgeExcludeIncludesDepNameAndVersion(
            matchedItem.commentBefore,
            upgrade.depName,
            newVersion,
          )
        ) {
          // normalize value (no quote handling needed)
          matchedItem.commentBefore =
            matchedItem.commentBefore + ` || ${newVersion}`;
          updated = true;
        }
      } else {
        matchedItem.commentBefore = ` Renovate security update: ${upgrade.depName}@${newVersion}`;
        updated = true;
      }

      if (
        !minimumReleaseAgeExcludeIncludesDepNameAndVersion(
          matchedItem.value,
          upgrade.depName,
          newVersion,
        )
      ) {
        matchedItem.value = matchedItem.value + ` || ${newVersion}`;
        updated = true;
      }
    } else {
      // add new entry
      const newItem = doc.createNode(`${upgrade.depName}@${newVersion}`);
      newItem.commentBefore = ` Renovate security update: ${upgrade.depName}@${newVersion}`;

      excludeNode.items.push(newItem);
      updated = true;
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
} {
  for (const item of items) {
    /* v8 ignore if -- should not happen */
    if (!isScalar(item) || !isString(item.value)) {
      continue;
    }

    if (item.value.startsWith(`${depName}@`)) {
      return {
        allExcluded: false,
        item,
      };
    }

    if (item.value === depName || matchRegexOrGlob(depName, item.value)) {
      return {
        allExcluded: true,
        item,
      };
    }
  }

  return {
    item: null,
    allExcluded: false,
  };
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
