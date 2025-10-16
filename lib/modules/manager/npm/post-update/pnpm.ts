import is from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { exec } from '../../../../util/exec';
import type {
  ExecOptions,
  ExtraEnv,
  ToolConstraint,
} from '../../../../util/exec/types';
import {
  deleteLocalFile,
  ensureCacheDir,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../../util/fs';
import { uniqueStrings } from '../../../../util/string';
import { parseSingleYaml } from '../../../../util/yaml';
import type { PostUpdateConfig, Upgrade } from '../../types';
import { PNPM_CACHE_DIR, PNPM_STORE_DIR } from '../constants';
import type { PnpmWorkspaceFile } from '../extract/types';
import { getNodeToolConstraint } from './node-version';
import type { GenerateLockFileResult, PnpmLockFile } from './types';
import { getPackageManagerVersion, lazyLoadPackageJson } from './utils';

function getPnpmConstraintFromUpgrades(upgrades: Upgrade[]): string | null {
  for (const upgrade of upgrades) {
    if (upgrade.depName === 'pnpm' && upgrade.newVersion) {
      return upgrade.newVersion;
    }
  }
  return null;
}

export async function generateLockFile(
  lockFileDir: string,
  env: NodeJS.ProcessEnv,
  config: PostUpdateConfig,
  upgrades: Upgrade[] = [],
): Promise<GenerateLockFileResult> {
  const lockFileName = upath.join(lockFileDir, 'pnpm-lock.yaml');
  logger.debug(`Spawning pnpm install to create ${lockFileName}`);
  let lockFile: string | null = null;
  let stdout: string | undefined;
  let stderr: string | undefined;
  const commands: string[] = [];
  try {
    const lazyPgkJson = lazyLoadPackageJson(lockFileDir);
    const pnpmToolConstraint: ToolConstraint = {
      toolName: 'pnpm',
      constraint:
        getPnpmConstraintFromUpgrades(upgrades) ?? // if pnpm is being upgraded, it comes first
        config.constraints?.pnpm ?? // from user config or extraction
        getPackageManagerVersion('pnpm', await lazyPgkJson.getValue()) ?? // look in package.json > packageManager or engines
        (await getConstraintFromLockFile(lockFileName)), // use lockfileVersion to find pnpm version range
    };

    const pnpmConfigCacheDir = await ensureCacheDir(PNPM_CACHE_DIR);
    const pnpmConfigStoreDir = await ensureCacheDir(PNPM_STORE_DIR);
    const extraEnv: ExtraEnv = {
      // those arwe no longer working and it's unclear if they ever worked
      NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
      npm_config_store: env.npm_config_store,
      // these are used by pnpm v5 to v10. Maybe earlier versions too
      npm_config_cache_dir: pnpmConfigCacheDir,
      npm_config_store_dir: pnpmConfigStoreDir,
      // pnpm stops reading npm_config_* env vars since v11
      pnpm_config_cache_dir: pnpmConfigCacheDir,
      pnpm_config_store_dir: pnpmConfigStoreDir,
    };
    const execOptions: ExecOptions = {
      cwdFile: lockFileName,
      extraEnv,
      docker: {},
      toolConstraints: [
        await getNodeToolConstraint(config, upgrades, lockFileDir, lazyPgkJson),
        pnpmToolConstraint,
      ],
    };
    /* v8 ignore next 4 -- needs test */
    if (GlobalConfig.get('exposeAllEnv')) {
      extraEnv.NPM_AUTH = env.NPM_AUTH;
      extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }

    const pnpmWorkspaceFilePath = getSiblingFileName(
      lockFileName,
      'pnpm-workspace.yaml',
    );

    let args = '--lockfile-only';

    // If it's not a workspaces project/monorepo, but single project with unrelated other npm project in source tree (for example, a git submodule),
    // `--recursive` will install un-wanted project.
    // we should avoid this.
    if (await localPathExists(pnpmWorkspaceFilePath)) {
      const pnpmWorkspace = parseSingleYaml<PnpmWorkspaceFile>(
        (await readLocalFile(pnpmWorkspaceFilePath, 'utf8'))!,
      );
      if (pnpmWorkspace?.packages?.length) {
        logger.debug(
          `Found pnpm workspace with ${pnpmWorkspace.packages.length} package definitions`,
        );
        // we are in a monorepo, 'pnpm update' needs the '--recursive' flag contrary to 'pnpm install'
        args += ' --recursive';
      }
    }
    if (!GlobalConfig.get('allowScripts')) {
      // If the admin disallows scripts, then neither scripts nor the pnpmfile should be run
      args += ' --ignore-scripts';
      args += ' --ignore-pnpmfile';
    } else if (config.ignoreScripts) {
      // If the admin allows scripts then always allow the pnpmfile
      args += ' --ignore-scripts';
    }

    logger.trace({ args }, 'pnpm command options');

    const lockUpdates = upgrades.filter((upgrade) => upgrade.isLockfileUpdate);

    if (lockUpdates.length !== upgrades.length) {
      // This command updates the lock file based on package.json
      commands.push(`pnpm install ${args}`);
    }

    // rangeStrategy = update-lockfile
    if (lockUpdates.length) {
      logger.debug('Performing lockfileUpdate (pnpm)');
      commands.push(
        `pnpm update --no-save ${lockUpdates
          // TODO: types (#22198)
          .map((update) => `${update.packageName!}@${update.newVersion!}`)
          .filter(uniqueStrings)
          .map(quote)
          .join(' ')} ${args}`,
      );
    }

    // postUpdateOptions
    if (config.postUpdateOptions?.includes('pnpmDedupe')) {
      commands.push('pnpm dedupe --ignore-scripts');
    }

    if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
      logger.debug(
        `Removing ${lockFileName} first due to lock file maintenance upgrade`,
      );
      try {
        await deleteLocalFile(lockFileName);
        /* v8 ignore start -- needs test */
      } catch (err) {
        logger.debug(
          { err, lockFileName },
          'Error removing `pnpm-lock.yaml` for lock file maintenance',
        );
      } /* v8 ignore stop -- needs test */
    }

    await exec(commands, execOptions);
    lockFile = await readLocalFile(lockFileName, 'utf8');
    /* v8 ignore start -- needs test */
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug(
      {
        commands,
        err,
        stdout,
        stderr,
        type: 'pnpm',
      },
      'lock file error',
    );
    return { error: true, stderr: err.stderr, stdout: err.stdout };
  } /* v8 ignore stop -- needs test */
  return { lockFile };
}

export async function getConstraintFromLockFile(
  lockFileName: string,
): Promise<string | null> {
  let constraint: string | null = null;
  try {
    const lockfileContent = await readLocalFile(lockFileName, 'utf8');
    if (!lockfileContent) {
      logger.trace(`Empty pnpm lock file: ${lockFileName}`);
      return null;
    }
    // TODO: use schema (#9610)
    const pnpmLock = parseSingleYaml<PnpmLockFile>(lockfileContent);
    if (
      !is.number(pnpmLock?.lockfileVersion) &&
      !is.numericString(pnpmLock?.lockfileVersion)
    ) {
      logger.trace(`Invalid pnpm lockfile version: ${lockFileName}`);
      return null;
    }
    // find matching lockfileVersion and use its constraints
    // if no match found use lockfileVersion 5
    // lockfileVersion 5 is the minimum version required to generate the pnpm-lock.yaml file
    const { lowerConstraint, upperConstraint } = lockToPnpmVersionMapping.find(
      (m) => m.lockfileVersion === pnpmLock.lockfileVersion,
    ) ?? {
      lockfileVersion: 5.0,
      lowerConstraint: '>=3',
      upperConstraint: '<3.5.0',
    };
    constraint = lowerConstraint;
    if (upperConstraint) {
      constraint += ` ${upperConstraint}`;
    }
  } catch (err) {
    logger.warn({ err }, 'Error getting pnpm constraints from lock file');
  }
  return constraint;
}

/**
 * pnpm lockfiles have corresponding version numbers called "lockfileVersion"
 * each lockfileVersion can only be generated by a certain pnpm version range
 * eg. lockfileVersion: 5.4 can only be generated by pnpm version >=7 && <8
 * official list can be found here : https://github.com/pnpm/spec/tree/master/lockfile
 * we use the mapping present below to find the compatible pnpm version range for a given lockfileVersion
 *
 * the various terms used in the mapping are explained below:
 * lowerConstraint : lowest pnpm version that can generate the lockfileVersion
 * upperConstraint : highest pnpm version that can generate the lockfileVersion
 * lowerBound      : highest pnpm version that is less than the lowerConstraint
 * upperBound      : lowest pnpm version that is greater than the upperConstraint
 *
 * To handle future lockfileVersions, we need to:
 * 1. add a upperBound and upperConstraint to the current latest lockfileVersion
 * 2. add an object for the new lockfileVersion with lowerBound and lowerConstraint
 *
 * lockfileVersion from v6 on are strings
 */
const lockToPnpmVersionMapping: LockToPnpmVersionMapping[] = [
  { lockfileVersion: '9.0', lowerConstraint: '>=9' },
  {
    lockfileVersion: '6.0',
    lowerConstraint: '>=7.24.2',
    upperConstraint: '<9',
  },
  {
    lockfileVersion: 5.4,
    lowerConstraint: '>=7',
    upperConstraint: '<8',
  },
  {
    lockfileVersion: 5.3,
    lowerConstraint: '>=6',
    upperConstraint: '<7',
  },
  {
    lockfileVersion: 5.2,
    lowerConstraint: '>=5.10.0',
    upperConstraint: '<6',
  },
  {
    lockfileVersion: 5.1,
    lowerConstraint: '>=3.5.0',
    upperConstraint: '<5.9.3',
  },
];

interface LockToPnpmVersionMapping {
  lockfileVersion: string | number;
  lowerConstraint: string;
  upperConstraint?: string;
}
