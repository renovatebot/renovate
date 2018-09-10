const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const upath = require('upath');

const endpoints = require('../../util/endpoints');

module.exports = {
  getLockFile,
};

async function getLockFile(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  logger.debug(`composer.getLockFile(${packageFileName})`);
  const lockFileName = packageFileName.replace(/\.json$/, '.lock');
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No composer.lock found');
    return null;
  }
  const cwd = upath.join(config.localDir, upath.dirname(packageFileName));
  let stdout;
  let stderr;
  try {
    const localPackageFileName = upath.join(config.localDir, packageFileName);
    const newPackageFileParsed = JSON.parse(newPackageFileContent);
    delete newPackageFileParsed.scripts;
    await fs.outputFile(
      localPackageFileName,
      JSON.stringify(newPackageFileParsed)
    );
    const localLockFileName = upath.join(config.localDir, lockFileName);
    if (!config.gitFs) {
      await fs.outputFile(localLockFileName, existingLockFileContent);
    }
    const credentials = endpoints.find({
      platform: 'github',
      host: 'api.github.com',
    });
    // istanbul ignore if
    if (credentials && credentials.token) {
      const authJson = {
        'github-oauth': {
          'github.com': credentials.token,
        },
      };
      const localAuthFileName = upath.join(cwd, 'auth.json');
      await fs.outputFile(localAuthFileName, JSON.stringify(authJson));
    }
    const env = { HOME: process.env.HOME, PATH: process.env.PATH };
    const startTime = process.hrtime();
    const cmd =
      ('composer update ' + updatedDeps.join(' ')).trim() +
      ' --ignore-platform-reqs';
    logger.debug({ cmd });
    ({ stdout, stderr } = await exec(cmd, {
      cwd,
      shell: true,
      env,
    }));
    logger.debug(`composer stdout:\n${stdout}`);
    logger.debug(`composer stderr:\n${stderr}`);
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
      name: lockFileName,
      contents: await fs.readFile(localLockFileName, 'utf8'),
    };
  } catch (err) {
    logger.warn(
      { err, message: err.message },
      'Failed to generate composer.lock'
    );
    return null;
  }
}
