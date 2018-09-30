const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const upath = require('upath');

module.exports = {
  getLockFile,
};

async function getLockFile(
  goModFileName,
  updatedDeps,
  newGoModContent,
  config
) {
  logger.debug(`gomod.getLockFile(${goModFileName})`);
  // TODO: use cache
  const sumFileName = goModFileName.replace(/\.mod$/, '.sum');
  const existingGoSumContent = await platform.getFile(sumFileName);
  if (!existingGoSumContent) {
    logger.debug('No go.sum found');
    return null;
  }
  const cwd = upath.join(config.localDir, upath.dirname(goModFileName));
  let stdout;
  let stderr;
  try {
    const localGoModFileName = upath.join(config.localDir, goModFileName);
    await fs.outputFile(localGoModFileName, newGoModContent);
    const localGoSumFileName = upath.join(config.localDir, sumFileName);
    if (!config.gitFs) {
      await fs.outputFile(localGoSumFileName, existingGoSumContent);
    }
    const env =
      config.global && config.global.exposeEnv
        ? process.env
        : {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
          };
    const startTime = process.hrtime();
    let cmd;
    if (config.binarySource === 'docker') {
      logger.info('Running go via docker');
      cmd = `docker run --rm `;
      const volumes = [config.localDir];
      cmd += volumes.map(v => `-v ${v}:${v} `).join('');
      cmd += `-w ${cwd} `;
      cmd += `golang:1.11.0 go`;
    } else {
      logger.info('Running go via global command');
      cmd = 'go';
    }
    const args = 'get';
    logger.debug({ cmd, args }, 'go get command');
    ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
      cwd,
      shell: true,
      env,
    }));
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: 'go.sum', stdout, stderr },
      'Generated lockfile'
    );
    // istanbul ignore if
    if (config.gitFs) {
      const status = await platform.getRepoStatus();
      if (!status.modified.includes(sumFileName)) {
        return null;
      }
    } else {
      const newGoSumContent = await fs.readFile(localGoSumFileName, 'utf8');

      if (newGoSumContent === existingGoSumContent) {
        logger.debug('go.sum is unchanged');
        return null;
      }
    }
    logger.debug('Returning updated go.sum');
    return {
      name: sumFileName,
      contents: await fs.readFile(localGoSumFileName, 'utf8'),
    };
  } catch (err) {
    logger.warn({ err, message: err.message }, 'Failed to generate go.sum');
    return null;
  }
}
