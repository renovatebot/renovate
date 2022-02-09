import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types';
import { deleteLocalFile, readLocalFile } from '../../../util/fs';
import type { PostUpdateConfig, Upgrade } from '../../types';
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
    const pnpmUpdate = upgrades.find(
      (upgrade) =>
        upgrade.depType === 'packageManager' && upgrade.depName === 'pnpm'
    );
    const pnpmToolConstraint: ToolConstraint = {
      toolName: 'pnpm',
      constraint: pnpmUpdate ? pnpmUpdate.newValue : config.constraints?.pnpm,
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
        await deleteLocalFile(lockFileName);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { err, lockFileName },
          'Error removing yarn.lock for lock file maintenance'
        );
      }
    }

    await exec(`${cmd} ${args}`, execOptions);
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
      'lock file error'
    );
    return { error: true, stderr: err.stderr, stdout: err.stdout };
  }
  return { lockFile };
}
