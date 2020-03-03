import { readFile } from 'fs-extra';
import { join } from 'upath';
import { getInstalledPath } from 'get-installed-path';
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
    logger.debug(`Using yarn: ${cmd}`);
    let cmdExtras = '';
    cmdExtras += ' --ignore-scripts';
    cmdExtras += ' --ignore-engines';
    cmdExtras += ' --ignore-platform';
    cmdExtras += process.env.YARN_MUTEX_FILE
      ? ` --mutex file:${process.env.YARN_MUTEX_FILE}`
      : ' --mutex network:31879';
    const installCmd = cmd + ' install' + cmdExtras;
    // TODO: Switch to native util.promisify once using only node 8
    await exec(installCmd, {
      cwd,
      env,
    });
    const lockUpdates = upgrades
      .filter(upgrade => upgrade.isLockfileUpdate)
      .map(upgrade => upgrade.depName);
    if (lockUpdates.length) {
      logger.debug('Performing lockfileUpdate (yarn)');
      const updateCmd =
        cmd +
        ' upgrade' +
        lockUpdates.map(depName => ` ${depName}`).join('') +
        cmdExtras;
      const updateRes = await exec(updateCmd, {
        cwd,
        env,
      });
      stdout += updateRes.stdout
        ? /* istanbul ignore next */ updateRes.stdout
        : '';
      stderr += updateRes.stderr
        ? /* istanbul ignore next */ updateRes.stderr
        : '';
    }
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
      stdout += dedupeRes.stdout
        ? /* istanbul ignore next */ dedupeRes.stdout
        : '';
      stderr += dedupeRes.stderr
        ? /* istanbul ignore next */ dedupeRes.stderr
        : '';
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
      stdout += dedupeRes.stdout
        ? /* istanbul ignore next */ dedupeRes.stdout
        : '';
      stderr += dedupeRes.stderr
        ? /* istanbul ignore next */ dedupeRes.stderr
        : '';
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
