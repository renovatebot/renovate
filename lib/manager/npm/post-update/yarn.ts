import { readFile } from 'fs-extra';
import { join } from 'upath';
import { SYSTEM_INSUFFICIENT_DISK_SPACE } from '../../../constants/error-messages';
import { DatasourceError } from '../../../datasource';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import { BinarySource } from '../../../util/exec/common';
import { api as semver } from '../../../versioning/semver';
import { PostUpdateConfig, Upgrade } from '../../common';

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
  logger.debug(`Spawning yarn install to create ${cwd}/yarn.lock`);
  let lockFile = null;
  let stdout = '';
  let stderr = '';
  let cmd = 'yarn';
  try {
    if (config.binarySource === BinarySource.Docker) {
      logger.debug('Running yarn via docker');
      cmd = `docker run --rm `;
      // istanbul ignore if
      if (config.dockerUser) {
        cmd += `--user=${config.dockerUser} `;
      }
      const volumes = [cwd];
      if (config.cacheDir) {
        volumes.push(config.cacheDir);
      }
      cmd += volumes.map((v) => `-v "${v}":"${v}" `).join('');
      // istanbul ignore if
      if (config.dockerMapDotfiles) {
        const homeDir =
          process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
        const homeNpmrc = join(homeDir, '.npmrc');
        cmd += `-v ${homeNpmrc}:/home/ubuntu/.npmrc `;
      }
      const envVars = ['NPM_CONFIG_CACHE', 'npm_config_store'];
      cmd += envVars.map((e) => `-e ${e} `).join('');
      cmd += `-w "${cwd}" `;
      cmd += `renovate/yarn yarn`;
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
