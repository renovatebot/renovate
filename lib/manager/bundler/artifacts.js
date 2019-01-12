const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const upath = require('upath');

module.exports = {
  getArtifacts,
};

async function getArtifacts(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  logger.debug(`bundler.getArtifacts(${packageFileName})`);
  const lockFileName = packageFileName + '.lock';
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Gemfile.lock found');
    return null;
  }
  const cwd = upath.join(config.localDir, upath.dirname(packageFileName));
  let stdout;
  let stderr;
  try {
    const localPackageFileName = upath.join(config.localDir, packageFileName);
    await fs.outputFile(localPackageFileName, newPackageFileContent);
    const localLockFileName = upath.join(config.localDir, lockFileName);
    if (!config.gitFs) {
      await fs.outputFile(localLockFileName, existingLockFileContent);
      const fileList = await platform.getFileList();
      const gemspecs = fileList.filter(file => file.endsWith('.gemspec'));
      for (const gemspec of gemspecs) {
        const content = await platform.getFile(gemspec);
        await fs.outputFile(upath.join(config.localDir, gemspec), content);
      }
    }
    const env =
      global.trustLevel === 'high'
        ? process.env
        : {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
          };
    const startTime = process.hrtime();
    let cmd;
    if (config.binarySource === 'docker') {
      logger.info('Running bundler via docker');
      cmd = `docker run --rm `;
      const volumes = [config.localDir];
      cmd += volumes.map(v => `-v ${v}:${v} `).join('');
      const envVars = [];
      cmd += envVars.map(e => `-e ${e} `);
      cmd += `-w ${cwd} `;
      cmd += `renovate/bundler bundler`;
    } else {
      logger.info('Running bundler via global bundler');
      cmd = 'bundler';
    }
    const args = 'lock';
    logger.debug({ cmd, args }, 'bundler command');
    ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
      cwd,
      shell: true,
      env,
    }));
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: 'Gemfile.lock', stdout, stderr },
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
        logger.debug('Gemfile.lock is unchanged');
        return null;
      }
    }
    logger.debug('Returning updated Gemfile.lock');
    return {
      file: {
        name: lockFileName,
        contents: await fs.readFile(localLockFileName, 'utf8'),
      },
    };
  } catch (err) {
    if (
      err.stdout &&
      err.stdout.includes('No such file or directory') &&
      !config.gitFs
    ) {
      logger.warn(
        { err },
        'It is necessary to run Renovate in gitFs mode - contact your bot administrator'
      );
    } else {
      logger.warn(
        { err, message: err.message },
        'Failed to generate bundler.lock'
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
