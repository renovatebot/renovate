import { readFile } from 'fs-extra';
import { join } from 'upath';
import { getInstalledPath } from 'get-installed-path';
import { api as semver } from '../../../versioning/semver';
import { exec } from '../../../util/exec';
import { logger } from '../../../logger';
import { PostUpdateConfig, Upgrade } from '../../common';
import { SYSTEM_INSUFFICIENT_DISK_SPACE } from '../../../constants/error-messages';
import { BinarySource } from '../../../util/exec/common';
import { DatasourceError } from '../../../datasource';

export interface GenerateLockFileResult {
  error?: boolean;
  lockFile?: string;
  stderr?: string;
}

export async function generateLockFile(
  cwd: string,
  env?: NodeJS.ProcessEnv,
  config: PostUpdateConfig = {},
  upgrades: Upgrade[] = []
): Promise<GenerateLockFileResult> {
  const { binarySource } = config;
  logger.debug(`Spawning yarn install to create ${cwd}/yarn.lock`);
  let lockFile = null;
  let stdout = '';
  let stderr = '';
  let cmd: string;
  try {
    try {
      // See if renovate is installed locally
      const installedPath = join(
        await getInstalledPath('yarn', {
          local: true,
        }),
        'bin/yarn.js'
      );
      cmd = `node ${installedPath}`;
      const yarnIntegrity =
        config.upgrades &&
        config.upgrades.some((upgrade) => upgrade.yarnIntegrity);
      if (!yarnIntegrity) {
        logger.warn('Using yarn@1.9.4 for install is deprecated');
        try {
          const renovatePath = await getInstalledPath('renovate', {
            local: true,
          });
          logger.debug('Using nested bundled yarn@1.9.4 for install');
          cmd = 'node ' + join(renovatePath, 'bin/yarn-1.9.4.js');
        } catch (err) {
          logger.debug('Using bundled yarn@1.9.4 for install');
          cmd = cmd.replace(
            'node_modules/yarn/bin/yarn.js',
            'bin/yarn-1.9.4.js'
          );
        }
      }
    } catch (localerr) {
      logger.debug('No locally installed yarn found');
      // Look inside globally installed renovate
      try {
        const renovateLocation = await getInstalledPath('renovate');
        const installedPath = join(
          await getInstalledPath('yarn', {
            local: true,
            cwd: renovateLocation,
          }),
          'bin/yarn.js'
        );
        cmd = `node ${installedPath}`;
      } catch (nestederr) {
        logger.debug('Could not find globally nested yarn');
        // look for global yarn
        try {
          const installedPath = join(
            await getInstalledPath('yarn'),
            'bin/yarn.js'
          );
          cmd = `node ${installedPath}`;
        } catch (globalerr) {
          logger.warn('Could not find globally installed yarn');
          cmd = 'yarn';
        }
      }
    }
    if (binarySource === BinarySource.Global) {
      cmd = 'yarn';
    }

    const { stdout: yarnVersion } = await exec(`${cmd} --version`);

    logger.debug(`Using yarn: ${cmd} ${yarnVersion}`);

    const yarnMajorVersion = semver.getMajor(yarnVersion);

    let cmdExtras = '';
    const cmdEnv = { ...env };
    if (yarnMajorVersion < 2) {
      cmdExtras += ' --ignore-scripts';
    } else {
      cmdEnv.YARN_ENABLE_SCRIPTS = '0';
    }
    cmdExtras += ' --ignore-engines';
    cmdExtras += ' --ignore-platform';
    cmdExtras += process.env.YARN_MUTEX_FILE
      ? ` --mutex file:${process.env.YARN_MUTEX_FILE}`
      : ' --mutex network:31879';
    const installCmd = cmd + ' install' + cmdExtras;
    // TODO: Switch to native util.promisify once using only node 8
    await exec(installCmd, {
      cwd,
      env: cmdEnv,
    });
    const lockUpdates = upgrades
      .filter((upgrade) => upgrade.isLockfileUpdate)
      .map((upgrade) => upgrade.depName);
    if (lockUpdates.length) {
      logger.debug('Performing lockfileUpdate (yarn)');
      const updateCmd =
        cmd +
        ' upgrade' +
        lockUpdates.map((depName) => ` ${depName}`).join('') +
        cmdExtras;
      const updateRes = await exec(updateCmd, {
        cwd,
        env,
      });
      // istanbul ignore next
      stdout += updateRes.stdout || '';
      stderr += updateRes.stderr || '';
    }

    if (yarnMajorVersion < 2) {
      if (
        config.postUpdateOptions &&
        config.postUpdateOptions.includes('yarnDedupeFewer')
      ) {
        logger.debug('Performing yarn dedupe fewer');
        const dedupeCommand =
          'npx yarn-deduplicate@1.1.1 --strategy fewer && yarn';
        const dedupeRes = await exec(dedupeCommand, {
          cwd,
          env,
        });
        // istanbul ignore next
        stdout += dedupeRes.stdout || '';
        stderr += dedupeRes.stderr || '';
      }
      if (
        config.postUpdateOptions &&
        config.postUpdateOptions.includes('yarnDedupeHighest')
      ) {
        logger.debug('Performing yarn dedupe highest');
        const dedupeCommand =
          'npx yarn-deduplicate@1.1.1 --strategy highest && yarn';
        const dedupeRes = await exec(dedupeCommand, {
          cwd,
          env,
        });
        // istanbul ignore next
        stdout += dedupeRes.stdout || '';
        stderr += dedupeRes.stderr || '';
      }
    } else if (
      config.postUpdateOptions &&
      config.postUpdateOptions.some((option) => option.startsWith('yarnDedupe'))
    ) {
      logger.warn('yarn-deduplicate is not supported since yarn 2');
    }
    lockFile = await readFile(join(cwd, 'yarn.lock'), 'utf8');
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      {
        cmd,
        err,
        stdout,
        stderr,
        type: 'yarn',
      },
      'lock file error'
    );
    if (err.stderr) {
      if (err.stderr.includes('ENOSPC: no space left on device')) {
        throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
      }
      if (
        err.stderr.includes('The registry may be down.') ||
        err.stderr.includes('getaddrinfo ENOTFOUND registry.yarnpkg.com') ||
        err.stderr.includes('getaddrinfo ENOTFOUND registry.npmjs.org')
      ) {
        throw new DatasourceError(err);
      }
    }
    return { error: true, stderr: err.stderr };
  }
  return { lockFile };
}
