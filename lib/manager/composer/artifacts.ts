import is from '@sindresorhus/is';
import URL from 'url';
import fs from 'fs-extra';
import upath from 'upath';
import { exec, ExecOptions } from '../../util/exec';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';
import { logger } from '../../logger';
import * as hostRules from '../../util/host-rules';
import { platform } from '../../platform';
import { SYSTEM_INSUFFICIENT_DISK_SPACE } from '../../constants/error-messages';
import {
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`composer.updateArtifacts(${packageFileName})`);

  const cacheDir =
    process.env.COMPOSER_CACHE_DIR ||
    upath.join(config.cacheDir, './others/composer');
  await fs.ensureDir(cacheDir);
  logger.debug(`Using composer cache ${cacheDir}`);

  const lockFileName = packageFileName.replace(/\.json$/, '.lock');
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No composer.lock found');
    return null;
  }
  const cwd = upath.join(config.localDir, upath.dirname(packageFileName));
  await fs.ensureDir(upath.join(cwd, 'vendor'));
  try {
    const localPackageFileName = upath.join(config.localDir, packageFileName);
    await fs.outputFile(localPackageFileName, newPackageFileContent);
    const localLockFileName = upath.join(config.localDir, lockFileName);
    if (config.isLockFileMaintenance) {
      await fs.remove(localLockFileName);
    }
    const authJson = {};
    let credentials = hostRules.find({
      hostType: PLATFORM_TYPE_GITHUB,
      url: 'https://api.github.com/',
    });
    // istanbul ignore if
    if (credentials && credentials.token) {
      authJson['github-oauth'] = {
        'github.com': credentials.token,
      };
    }
    credentials = hostRules.find({
      hostType: PLATFORM_TYPE_GITLAB,
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
        for (const regUrl of config.registryUrls) {
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
    const execOptions: ExecOptions = {
      cwd,
      extraEnv: {
        COMPOSER_CACHE_DIR: cacheDir,
      },
      docker: {
        image: 'renovate/composer',
      },
    };
    const cmd = 'composer';
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
    await exec(`${cmd} ${args}`, execOptions);
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
