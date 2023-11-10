import is from '@sindresorhus/is';
import { load } from 'js-yaml';
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
import { deleteLocalFile, readLocalFile } from '../../../../util/fs';
import type { PostUpdateConfig, Upgrade } from '../../types';
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
  let cmd = 'pnpm';
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

    const extraEnv: ExtraEnv = {
      NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
      npm_config_store: env.npm_config_store,
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
    // istanbul ignore if
    if (GlobalConfig.get('exposeAllEnv')) {
      extraEnv.NPM_AUTH = env.NPM_AUTH;
      extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }
    const commands: string[] = [];

    cmd = 'pnpm';
    let args = 'install --recursive --lockfile-only';
    if (!GlobalConfig.get('allowScripts') || config.ignoreScripts) {
      args += ' --ignore-scripts';
      args += ' --ignore-pnpmfile';
    }
    logger.trace({ cmd, args }, 'pnpm command');
    commands.push(`${cmd} ${args}`);

    // postUpdateOptions
    if (config.postUpdateOptions?.includes('pnpmDedupe')) {
      commands.push('pnpm dedupe --config.ignore-scripts=true');
    }

    if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
      logger.debug(
        `Removing ${lockFileName} first due to lock file maintenance upgrade`,
      );
      try {
        await deleteLocalFile(lockFileName);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { err, lockFileName },
          'Error removing yarn.lock for lock file maintenance',
        );
      }
    }

    await exec(commands, execOptions);
    lockFile = await readLocalFile(lockFileName, 'utf8');
  } catch (err) /* istanbul ignore next */ {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug(
      {
        cmd,
        err,
        stdout,
        stderr,
        type: 'pnpm',
      },
      'lock file error',
    );
    return { error: true, stderr: err.stderr, stdout: err.stdout };
  }
  return { lockFile };
}

export async function getConstraintFromLockFile(
  lockFileName: string,
): Promise<string | null> {
  let constraint: string | null = null;
  try {
    const lockfileContent = await readLocalFile(lockFileName, 'utf8');
    if (!lockfileContent) {
      return null;
    }
    const pnpmLock = load(lockfileContent) as PnpmLockFile;
    if (!is.number(pnpmLock?.lockfileVersion)) {
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
 pnpm lockfiles have corresponding version numbers called "lockfileVersion"
 each lockfileVersion can only be generated by a certain pnpm version ranges
 eg. lockfileVersion: 5.4 can only be generated by pnpm version >=7 && <8
 official list can be found here : https://github.com/pnpm/spec/tree/master/lockfile
 we use the mapping present below to find the compatible pnpm version range for a given lockfileVersion

 the various terms used in the mapping are explained below:
 lowerConstriant : lowest pnpm version that can generate the lockfileVersion
 upperConstraint : highest pnpm version that can generate the lockfileVersion
 lowerBound      : highest pnpm version that is less than the lowerConstraint
 upperBound      : lowest pnpm version that is greater than upperConstraint

 For handling future lockfileVersions, we need to:
 1. add a upperBound and upperConstraint to the current lastest lockfileVersion
 2. add an object for the new lockfileVersion with lowerBound and lowerConstraint
 */

const lockToPnpmVersionMapping = [
  { lockfileVersion: 6.0, lowerConstraint: '>=7.24.2' },
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
