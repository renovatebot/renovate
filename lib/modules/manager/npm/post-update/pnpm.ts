import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { exec } from '../../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../../util/exec/types';
import { readFile, remove } from '../../../../util/fs';
import type { PostUpdateConfig, Upgrade } from '../../types';
import type { NpmPackage } from '../extract/types';
import { getNodeConstraint } from './node-version';
import type { GenerateLockFileResult } from './types';

export async function generateLockFile(
  cwd: string,
  env: NodeJS.ProcessEnv,
  config: PostUpdateConfig,
  upgrades: Upgrade[] = []
): Promise<GenerateLockFileResult> {
  const lockFileName = upath.join(cwd, 'pnpm-lock.yaml');
  logger.debug(`Spawning pnpm install to create ${lockFileName}`);
  let lockFile = null;
  let stdout: string;
  let stderr: string;
  let cmd = 'pnpm';
  try {
    const pnpmToolConstraint: ToolConstraint = {
      toolName: 'pnpm',
      constraint: config.constraints?.pnpm ?? (await getPnpmContraint(cwd)),
    };
    const tagConstraint = await getNodeConstraint(config);
    const execOptions: ExecOptions = {
      cwd,
      extraEnv: {
        NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
        npm_config_store: env.npm_config_store,
      },
      docker: {
        image: 'node',
        tagScheme: 'node',
        tagConstraint,
      },
      toolConstraints: [pnpmToolConstraint],
    };
    // istanbul ignore if
    if (GlobalConfig.get('exposeAllEnv')) {
      execOptions.extraEnv.NPM_AUTH = env.NPM_AUTH;
      execOptions.extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }
    cmd = 'pnpm';
    let args = 'install --recursive --lockfile-only';
    if (!GlobalConfig.get('allowScripts') || config.ignoreScripts) {
      args += ' --ignore-scripts';
      args += ' --ignore-pnpmfile';
    }
    logger.debug({ cmd, args }, 'pnpm command');

    if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
      logger.debug(
        `Removing ${lockFileName} first due to lock file maintenance upgrade`
      );
      try {
        await remove(lockFileName);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { err, lockFileName },
          'Error removing yarn.lock for lock file maintenance'
        );
      }
    }

    await exec(`${cmd} ${args}`, execOptions);
    lockFile = await readFile(lockFileName, 'utf8');
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
      'lock file error'
    );
    return { error: true, stderr: err.stderr, stdout: err.stdout };
  }
  return { lockFile };
}

async function getPnpmContraint(cwd: string): Promise<string> {
  let result;
  const rootPackageJson = upath.join(cwd, 'package.json');
  const content = await readFile(rootPackageJson, 'utf8');
  if (content) {
    const packageJson: NpmPackage = JSON.parse(content);
    const packageManager = packageJson?.packageManager;
    if (packageManager?.includes('@')) {
      const nameAndVersion = packageManager.split('@');
      const name = nameAndVersion[0];
      if (name === 'pnpm') {
        result = nameAndVersion[1];
      }
    } else {
      const engines = packageJson?.engines;
      if (engines) {
        result = engines['pnpm'];
      }
    }
  }
  return result;
}
