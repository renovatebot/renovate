import upath from 'upath';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  ensureCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { NpmDatasource } from '../../datasource/npm/index.js';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { PNPM_CACHE_DIR, PNPM_STORE_DIR } from './constants';
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

// Normalize stdout by trimming whitespace and handling undefined values
// Mostly just for testability
export function normalizeStdout(stdout?: string): string {
  return (stdout ?? '').trim();
}

// Instead of running 'corepack use' we directly compute the SRI hash from the npm registry
// This step is necessary because 'corepack use' will fail due to prepare scripts
export async function updateArtifacts({
  packageFileName,
  config,
  updatedDeps,
  newPackageFileContent: existingPackageFileContent,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`npm.updateArtifacts(${packageFileName})`);
  const packageManagerUpdate = updatedDeps.find(
    (dep) => dep.depType === 'packageManager',
  );

  if (!packageManagerUpdate) {
    logger.debug('No packageManager updates - returning null');
    return null;
  }

  const { currentValue, depName, newVersion } = packageManagerUpdate;

  // Continue only if the currentValue already has hash in it
  if (!currentValue || !regEx(versionWithHashRegString).test(currentValue)) {
    return null;
  }

  // write old updates before executing corepack update so that they are not removed from package file
  await writeLocalFile(packageFileName, existingPackageFileContent);

  // Asumming that corepack only needs to modify the package.json file in the root folder
  // As it should not be regular practice to have different package managers in different workspaces
  // We compute the hash from npm’s `dist.integrity` (Base64) and convert it to hex, mirroring Corepack’s conversion logic.
  // Reference: corepackUtils.ts#L300 (commit 57bfb67…) — https://github.com/nodejs/corepack/blob/57bfb67b062ea1b8746b302bcdbf9f8e8438c526/sources/corepackUtils.ts#L300
  const pkgFileDir = upath.dirname(packageFileName);
  const { additionalNpmrcContent } = processHostRules();
  const npmrcContent = await getNpmrcContent(pkgFileDir);
  const lazyPkgJson = lazyLoadPackageJson(pkgFileDir);

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
      // To make sure pnpm store location is consistent between adding the integrity
      // here and the pnpm commands in ./post-update/pnpm.ts. Check
      // ./post-update/pnpm.ts for more details.
      npm_config_cache_dir: pnpmConfigCacheDir,
      npm_config_store_dir: pnpmConfigStoreDir,
      pnpm_config_cache_dir: pnpmConfigCacheDir,
      pnpm_config_store_dir: pnpmConfigStoreDir,
    },
    toolConstraints: [nodeConstraints],
    docker: {},
  };

  await updateNpmrcContent(pkgFileDir, npmrcContent, additionalNpmrcContent);
  try {
    const datasource = new NpmDatasource();
    const registryUrl = 'https://registry.npmjs.org';
    let integrity = '';
    let shasum = '';

    const digest =
      (await datasource.getDigest(
        { packageName: depName!, registryUrl },
        newVersion,
      )) ?? '';

    if (regEx(/^sha\d+-/).test(digest)) {
      integrity = digest;
    }

    if (!integrity) {
      let res: { stdout?: string } = {};
      try {
        res = await exec(
          `npm view ${depName}@${newVersion} dist.integrity`,
          execOptions,
        );
      } catch (err) {
        logger.debug(err, 'Error fetching integrity via npm CLI');
        // ensure the "No valid integrity or shasum found" path is taken
        res = { stdout: '' };
      }
      integrity = normalizeStdout(res.stdout);
    }

    if (!integrity) {
      if (digest && regEx(/^[a-f0-9]{40,128}$/).test(digest)) {
        shasum = digest;
      } else {
        let res: { stdout?: string } = {};
        try {
          res = await exec(
            `npm view ${depName}@${newVersion} dist.shasum`,
            execOptions,
          );
        } catch (err) {
          logger.debug(err, 'Error fetching shasum via npm CLI');
          // ensure the "No valid integrity or shasum found" path is taken
          res = { stdout: '' };
        }
        shasum = normalizeStdout(res.stdout);
      }
    }

    let newPackageManagerValue = '';
    if (integrity && /^sha\d+-/.test(integrity)) {
      const [algo, b64] = integrity.split('-', 2);
      const hex = Buffer.from(b64, 'base64').toString('hex');

      const expectedLen =
        algo === 'sha512' ? 128 : algo === 'sha256' ? 64 : null;
      if (expectedLen && hex.length !== expectedLen) {
        throw new Error(
          `Unexpected ${algo} hex length (${hex.length}) for ${depName}@${newVersion}`,
        );
      }
      newPackageManagerValue = `${depName}@${newVersion}+${algo}.${hex}`;
    } else if (shasum && /^[a-f0-9]{40,128}$/.test(shasum)) {
      newPackageManagerValue = `${depName}@${newVersion}+sha1.${shasum}`;
    } else {
      throw new Error(
        `No valid integrity or shasum found for ${depName}@${newVersion}`,
      );
    }

    const fileText = await readLocalFile(packageFileName, 'utf8');
    const pkg = JSON.parse(fileText!);
    const prev = pkg.packageManager;

    if (prev === newPackageManagerValue) {
      await resetNpmrcContent(pkgFileDir, npmrcContent);
      return null;
    }

    pkg.packageManager = newPackageManagerValue;

    const updatedText = JSON.stringify(pkg, null, 2) + '\n';
    await writeLocalFile(packageFileName, updatedText);

    await resetNpmrcContent(pkgFileDir, npmrcContent);
    logger.debug('Returning updated package.json');

    return [
      {
        file: {
          type: 'addition',
          path: packageFileName,
          contents: updatedText,
        },
      },
    ];
  } catch (err: any) {
    logger.warn({ err }, 'Error updating package.json');
    await resetNpmrcContent(pkgFileDir, npmrcContent);
    return [
      {
        artifactError: {
          fileName: packageFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
