const is = require('@sindresorhus/is');
const URL = require('url');
const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const upath = require('upath');
const os = require('os');
const hostRules = require('../../util/host-rules');

module.exports = {
  getArtifacts,
};

async function getArtifacts(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  logger.debug(`composer.getArtifacts(${packageFileName})`);
  process.env.COMPOSER_CACHE_DIR =
    process.env.COMPOSER_CACHE_DIR ||
    upath.join(os.tmpdir(), '/renovate/cache/composer');
  await fs.ensureDir(process.env.COMPOSER_CACHE_DIR);
  logger.debug('Using composer cache ' + process.env.COMPOSER_CACHE_DIR);
  const lockFileName = packageFileName.replace(/\.json$/, '.lock');
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No composer.lock found');
    return null;
  }
  const cwd = upath.join(config.localDir, upath.dirname(packageFileName));
  await fs.ensureDir(upath.join(cwd, 'vendor'));
  let stdout;
  let stderr;
  try {
    const localPackageFileName = upath.join(config.localDir, packageFileName);
    await fs.outputFile(localPackageFileName, newPackageFileContent);
    const localLockFileName = upath.join(config.localDir, lockFileName);
    if (!config.gitFs) {
      await fs.outputFile(localLockFileName, existingLockFileContent);
    }
    let authJson = {};
    let credentials = hostRules.find({
      platform: 'github',
      host: 'api.github.com',
    });
    // istanbul ignore if
    if (credentials && credentials.token) {
      authJson['github-oauth'] = {
        'github.com': credentials.token,
      };
    }
    credentials = hostRules.find({
      platform: 'gitlab',
      host: 'gitlab.com',
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
          if (regUrl.url) {
            const { host } = URL.parse(regUrl.url);
            const hostRule = hostRules.find({
              platform: 'packagist',
              host,
            });
            if (hostRule) {
              // istanbul ignore else
              if (hostRule.username && hostRule.password) {
                authJson = authJson || {};
                authJson['http-basic'] = authJson['http-basic'] || {};
                authJson['http-basic'][host] = {
                  username: hostRule.username,
                  password: hostRule.password,
                };
              } else {
                logger.info('Warning: unknown composer host rule type');
              }
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
    const env =
      global.trustLevel === 'high'
        ? process.env
        : {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
            COMPOSER_CACHE_DIR: process.env.COMPOSER_CACHE_DIR,
          };
    const startTime = process.hrtime();
    let cmd;
    if (config.binarySource === 'docker') {
      logger.info('Running composer via docker');
      cmd = `docker run --rm `;
      const volumes = [config.localDir, process.env.COMPOSER_CACHE_DIR];
      cmd += volumes.map(v => `-v ${v}:${v} `).join('');
      const envVars = ['COMPOSER_CACHE_DIR'];
      cmd += envVars.map(e => `-e ${e} `);
      cmd += `-w ${cwd} `;
      cmd += `renovate/composer composer`;
    } else {
      logger.info('Running composer via global composer');
      cmd = 'composer';
    }
    const args =
      ('update ' + updatedDeps.join(' ')).trim() +
      ' --ignore-platform-reqs --no-ansi --no-interaction --no-scripts --no-autoloader';
    logger.debug({ cmd, args }, 'composer update command');
    ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
      cwd,
      shell: true,
      env,
    }));
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: 'composer.lock', stdout, stderr },
      'Generated lockfile'
    );
    // istanbul ignore if
    if (config.gitFs) {
      const status = await platform.getRepoStatus();
      if (!status.modified.includes(lockFileName)) {
        return null;
      }
    } else {
      const newLockFileContent = await fs.readFile(localLockFileName, 'utf8');

      if (newLockFileContent === existingLockFileContent) {
        logger.debug('composer.lock is unchanged');
        return null;
      }
    }
    logger.debug('Returning updated composer.lock');
    return {
      file: {
        name: lockFileName,
        contents: await fs.readFile(localLockFileName, 'utf8'),
      },
    };
  } catch (err) {
    if (
      err.message &&
      err.message.includes(
        'Your requirements could not be resolved to an installable set of packages.'
      )
    ) {
      logger.info('Composer requirements cannot be resolved');
    } else {
      logger.warn(
        { err, message: err.message },
        'Failed to generate composer.lock'
      );
    }
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }
}
