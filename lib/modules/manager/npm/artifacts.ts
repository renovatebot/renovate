import { isNonEmptyArray, isNonEmptyObject, isNumber } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  ensureCacheDir,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { matchRegexOrGlob } from '../../../util/string-match';
import { parseSingleYaml } from '../../../util/yaml';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { PNPM_CACHE_DIR, PNPM_STORE_DIR } from './constants';
import type { PnpmWorkspaceFile } from './extract/types';
import { getNodeToolConstraint } from './post-update/node-version';
import { processHostRules } from './post-update/rules';
import { lazyLoadPackageJson } from './post-update/utils';
import {
  getNpmrcContent,
  resetNpmrcContent,
  updateNpmrcContent,
} from './utils';

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
  const pnpmShrinkwrap = updateArtifactsConfig.updatedDeps[0].managerData
    ?.pnpmShrinkwrap as string;
  const lockFileDir = upath.dirname(pnpmShrinkwrap);
  const lockFileName = upath.join(lockFileDir, 'pnpm-lock.yaml');
  const pnpmWorkspaceFilePath = getSiblingFileName(
    lockFileName,
    'pnpm-workspace.yaml',
  );

  if (!(await localPathExists(pnpmWorkspaceFilePath))) {
    return null;
  }

  const oldContent = (await readLocalFile(pnpmWorkspaceFilePath, 'utf8'))!;
  let packageFileContent = oldContent;
  let updated = false;

  for (const upgrade of updateArtifactsConfig.updatedDeps) {
    if (!upgrade.isVulnerabilityAlert) {
      continue;
    }
    logger.debug('updatePnpmWorkspace()');

    const pnpmWorkspace =
      parseSingleYaml<PnpmWorkspaceFile>(packageFileContent);
    if (!isNumber(pnpmWorkspace?.minimumReleaseAge)) {
      continue;
    }

    if (!isNonEmptyArray(pnpmWorkspace.minimumReleaseAgeExclude)) {
      logger.debug('Adding new exclude block');
      // add minimumReleaseAgeExclude
      const addedStr = `
        minimumReleaseAgeExclude:
         - ${upgrade.depName}@${upgrade.newValue}
      `;
      const newContent = oldContent + addedStr;
      await writeLocalFile(pnpmWorkspaceFilePath, newContent);
      packageFileContent = newContent;
      updated = true;
      continue;
    }
    // check if exlcude setting exists for the dep
    let matchingSetting: {
      match: boolean;
      matchType?: 'pattern' | 'all-versions' | 'single-versions';
      settingStr: string;
    } = { match: false, settingStr: '' };
    for (const setting of pnpmWorkspace.minimumReleaseAgeExclude ?? []) {
      const matchingRes = checkExcludeSetting(setting, upgrade.depName!);
      if (matchingRes.match) {
        matchingSetting = {
          match: matchingRes.match,
          matchType: matchingRes.matchType,
          settingStr: setting,
        };
      }
    }

    if (matchingSetting.match) {
      logger.debug('Matching setting found');
      if (matchingSetting.matchType === 'single-versions') {
        logger.debug('Matching setting found, appending ||');
        // need to find and replace the old setting by appending || <newValue>
        const newSetting =
          matchingSetting.settingStr + ` || ${upgrade.newValue}`;
        const newContent = oldContent.replace(
          matchingSetting.settingStr,
          newSetting,
        );
        await writeLocalFile(pnpmWorkspaceFilePath, newContent);
        packageFileContent = newContent;
        updated = true;
      }
    }
  }

  if (!updated) {
    return null;
  }

  return {
    file: {
      type: 'addition',
      path: pnpmWorkspaceFilePath,
      contents: packageFileContent,
    },
  };
}

function checkExcludeSetting(
  setting: string,
  depName: string,
): {
  match: boolean;
  matchType?: 'pattern' | 'all-versions' | 'single-versions';
} {
  if (setting.includes(depName)) {
    if (!setting.includes('@')) {
      return { match: true, matchType: 'all-versions' };
    }
    return { match: true, matchType: 'single-versions' };
  }

  // check if setting is a pattern
  // TODO: use getRegexOrGlobPredicate method
  const res = matchRegexOrGlob(depName, setting);
  if (res) {
    return { match: true, matchType: 'pattern' };
  }

  return { match: false };
}
