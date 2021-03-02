import { validRange } from 'semver';
import { quote } from 'shlex';
import { join } from 'upath';
import { getAdminConfig } from '../../../config/admin';
import { logger } from '../../../logger';
import { ExecOptions, exec } from '../../../util/exec';
import { readFile, remove } from '../../../util/fs';
import type { PostUpdateConfig, Upgrade } from '../../types';
import { getNodeConstraint } from './node-version';

export interface GenerateLockFileResult {
  error?: boolean;
  lockFile?: string;
  stderr?: string;
  stdout?: string;
}

export async function generateLockFile(
  cwd: string,
  env: NodeJS.ProcessEnv,
  config: PostUpdateConfig,
  upgrades: Upgrade[] = []
): Promise<GenerateLockFileResult> {
  const lockFileName = join(cwd, 'pnpm-lock.yaml');
  logger.debug(`Spawning pnpm install to create ${lockFileName}`);
  let lockFile = null;
  let stdout: string;
  let stderr: string;
  let cmd = 'pnpm';
  try {
    let installPnpm = 'npm i -g pnpm';
    const pnpmCompatibility = config.constraints?.pnpm;
    if (validRange(pnpmCompatibility)) {
      installPnpm += `@${quote(pnpmCompatibility)}`;
    }
    const preCommands = [installPnpm];
    const tagConstraint = await getNodeConstraint(config);
    const execOptions: ExecOptions = {
      cwd,
      extraEnv: {
        NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
        npm_config_store: env.npm_config_store,
      },
      docker: {
        image: 'renovate/node',
        tagScheme: 'npm',
        tagConstraint,
        preCommands,
      },
    };
    // istanbul ignore if
    if (getAdminConfig().trustLevel === 'high') {
      execOptions.extraEnv.NPM_AUTH = env.NPM_AUTH;
      execOptions.extraEnv.NPM_EMAIL = env.NPM_EMAIL;
      execOptions.extraEnv.NPM_TOKEN = env.NPM_TOKEN;
    }
    if (config.dockerMapDotfiles) {
      const homeDir =
        process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
      const homeNpmrc = join(homeDir, '.npmrc');
      execOptions.docker.volumes = [[homeNpmrc, '/home/ubuntu/.npmrc']];
    }
    cmd = 'pnpm';
    let args = 'install --recursive --lockfile-only';
    if (getAdminConfig().trustLevel !== 'high' || config.ignoreScripts) {
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
      } catch (err) /* c8 ignore next */ {
        logger.debug(
          { err, lockFileName },
          'Error removing yarn.lock for lock file maintenance'
        );
      }
    }

    await exec(`${cmd} ${args}`, execOptions);
    lockFile = await readFile(lockFileName, 'utf8');
  } catch (err) /* c8 ignore next */ {
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
