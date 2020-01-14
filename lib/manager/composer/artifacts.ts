import is from '@sindresorhus/is';
import URL from 'url';
import fs from 'fs-extra';
import upath from 'upath';
import { exec } from '../../util/exec';
import { UpdateArtifactsConfig, UpdateArtifactsResult } from '../common';
import { logger } from '../../logger';
import * as hostRules from '../../util/host-rules';
import { getChildProcessEnv } from '../../util/exec/env';
import { platform } from '../../platform';
import { SYSTEM_INSUFFICIENT_DISK_SPACE } from '../../constants/error-messages';

export async function updateArtifacts(
  packageFileName: string,
  updatedDeps: string[],
  newPackageFileContent: string,
  config: UpdateArtifactsConfig
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`composer.updateArtifacts(${packageFileName})`);
  const env = getChildProcessEnv(['COMPOSER_CACHE_DIR']);
  env.COMPOSER_CACHE_DIR =
    env.COMPOSER_CACHE_DIR || upath.join(config.cacheDir, './others/composer');
  await fs.ensureDir(env.COMPOSER_CACHE_DIR);
  logger.debug('Using composer cache ' + env.COMPOSER_CACHE_DIR);
  const lockFileName = packageFileName.replace(/\.json$/, '.lock');
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No composer.lock found');
    return null;
  }
  const cwd = upath.join(config.localDir, upath.dirname(packageFileName));
  await fs.ensureDir(upath.join(cwd, 'vendor'));
  let stdout: string;
  let stderr: string;
  try {
    const localPackageFileName = upath.join(config.localDir, packageFileName);
    await fs.outputFile(localPackageFileName, newPackageFileContent);
    const localLockFileName = upath.join(config.localDir, lockFileName);
    if (config.isLockFileMaintenance) {
      await fs.remove(localLockFileName);
    }
    const authJson = {};
    let credentials = hostRules.find({
      hostType: 'github',
      url: 'https://api.github.com/',
    });
    // istanbul ignore if
    if (credentials && credentials.token) {
      authJson['github-oauth'] = {
        'github.com': credentials.token,
      };
    }
    credentials = hostRules.find({
      hostType: 'gitlab',
      url: 'https://gitlab.com/api/v4/',
    });
    // istanbul ignore if
    if (credentials && credentials.token) {
      authJson['gitlab-token'] = {
        'gitlab.com': credentials.token,
      };
    }
    try {
      // istanbul ignore else
      if (is.array(config.registryUrls)) {
        for (const regUrl of config.registryUrls as string[]) {
          if (regUrl) {
            const { host } = URL.parse(regUrl);
            const hostRule = hostRules.find({
              hostType: 'packagist',
              url: regUrl,
            });
            // istanbul ignore else
            if (hostRule.username && hostRule.password) {
              logger.debug('Setting packagist auth for host ' + host);
              authJson['http-basic'] = authJson['http-basic'] || {};
              authJson['http-basic'][host] = {
                username: hostRule.username,
                password: hostRule.password,
              };
            } else {
              logger.debug('No packagist auth found for ' + regUrl);
            }
          }
        }
      } else if (config.registryUrls) {
        logger.warn(
          { registryUrls: config.registryUrls },
          'Non-array composer registryUrls'
        );
      }
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Error setting registryUrls auth for composer');
    }
    if (authJson) {
      const localAuthFileName = upath.join(cwd, 'auth.json');
      await fs.outputFile(localAuthFileName, JSON.stringify(authJson));
    }
    const startTime = process.hrtime();
    let cmd: string;
    if (config.binarySource === 'docker') {
      logger.info('Running composer via docker');
      cmd = `docker run --rm `;
      if (config.dockerUser) {
        cmd += `--user=${config.dockerUser} `;
      }
      const volumes = [config.localDir, env.COMPOSER_CACHE_DIR];
      cmd += volumes.map(v => `-v "${v}":"${v}" `).join('');
      const envVars = ['COMPOSER_CACHE_DIR'];
      cmd += envVars.map(e => `-e ${e} `);
      cmd += `-w "${cwd}" `;
      cmd += `renovate/composer composer`;
    } else if (
      config.binarySource === 'auto' ||
      config.binarySource === 'global'
    ) {
      logger.info('Running composer via global composer');
      cmd = 'composer';
    } else {
      logger.warn({ config }, 'Unsupported binarySource');
      cmd = 'composer';
    }
    let args;
    if (config.isLockFileMaintenance) {
      args = 'install';
    } else {
      args =
        ('update ' + updatedDeps.join(' ')).trim() + ' --with-dependencies';
    }
    args += ' --ignore-platform-reqs --no-ansi --no-interaction';
    if (global.trustLevel !== 'high' || config.ignoreScripts) {
      args += ' --no-scripts --no-autoloader';
    }
    logger.debug({ cmd, args }, 'composer command');
    ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
      cwd,
      env,
    }));
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: 'composer.lock', stdout, stderr },
      'Generated lockfile'
    );
    const status = await platform.getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }
    logger.debug('Returning updated composer.lock');
    return [
      {
        file: {
          name: lockFileName,
          contents: await fs.readFile(localLockFileName, 'utf8'),
        },
      },
    ];
  } catch (err) {
    if (
      err.message &&
      err.message.includes(
        'Your requirements could not be resolved to an installable set of packages.'
      )
    ) {
      logger.info('Composer requirements cannot be resolved');
    } else if (
      err.message &&
      err.message.includes('write error (disk full?)')
    ) {
      throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
    } else {
      logger.debug({ err }, 'Failed to generate composer.lock');
    }
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
