const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const upath = require('upath');
const hostRules = require('../../util/host-rules');

module.exports = {
  getArtifacts,
};

async function getArtifacts(
  goModFileName,
  updatedDeps,
  newGoModContent,
  config
) {
  logger.debug(`gomod.getArtifacts(${goModFileName})`);
  process.env.GOPATH =
    process.env.GOPATH || upath.join(config.cacheDir, './others/go');
  await fs.ensureDir(process.env.GOPATH);
  logger.debug('Using GOPATH: ' + process.env.GOPATH);
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
    const massagedGoMod = newGoModContent.replace(
      /\nreplace\s+[^\s]+\s+=>\s+\.\.\/.*/g,
      ''
    );
    if (massagedGoMod !== newGoModContent) {
      logger.debug('Removed some relative replace statements from go.mod');
    }
    await fs.outputFile(localGoModFileName, massagedGoMod);
    const localGoSumFileName = upath.join(config.localDir, sumFileName);
    if (!config.gitFs) {
      await fs.outputFile(localGoSumFileName, existingGoSumContent);
    }
    const env =
      global.trustLevel === 'high'
        ? process.env
        : {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
            GOPATH: process.env.GOPATH,
          };
    const startTime = process.hrtime();
    let cmd;
    if (config.binarySource === 'docker') {
      logger.info('Running go via docker');
      cmd = `docker run --rm `;
      const volumes = [config.localDir, process.env.GOPATH];
      cmd += volumes.map(v => `-v ${v}:${v} `).join('');
      const envVars = ['GOPATH'];
      cmd += envVars.map(e => `-e ${e} `).join('');
      cmd += '-e CGO_ENABLED=0 ';
      cmd += `-w ${cwd} `;
      cmd += `renovate/go `;
      const credentials = hostRules.find({
        platform: 'github',
        host: 'api.github.com',
      });
      if (credentials && credentials.token) {
        logger.debug('Setting github.com credentials');
        cmd += `bash -c "git config --global url.\\"https://${
          global.appMode
            ? `x-access-token:${credentials.token}`
            : credentials.token
        }@github.com/\\".insteadOf \\"https://github.com/\\" && go`;
      } else {
        cmd += 'go';
      }
    } else {
      logger.info('Running go via global command');
      cmd = 'go';
    }
    let args = 'get';
    if (cmd.includes('.insteadOf')) {
      args += '"';
    }
    logger.debug({ cmd, args }, 'go get command');
    ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
      cwd,
      shell: true,
      env,
    }));
    let duration = process.hrtime(startTime);
    let seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: 'go.sum', stdout, stderr },
      'Generated lockfile'
    );
    // istanbul ignore if
    if (
      config.postUpdateOptions &&
      config.postUpdateOptions.includes('gomodTidy')
    ) {
      if (config.gitFs) {
        args = 'mod tidy';
        if (cmd.includes('.insteadOf')) {
          args += '"';
        }
        logger.debug({ cmd, args }, 'go mod tidy command');
        ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
          cwd,
          shell: true,
          env,
        }));
        duration = process.hrtime(startTime);
        seconds = Math.round(duration[0] + duration[1] / 1e9);
        logger.info(
          { seconds, type: 'go.sum', stdout, stderr },
          'Tidied lockfile'
        );
      } else {
        logger.warn(
          'Renovate administrator should enable gitFs in order to support tidying go modules'
        );
      }
    }
    const res = [];
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
    res.push({
      file: {
        name: sumFileName,
        contents: await fs.readFile(localGoSumFileName, 'utf8'),
      },
    });
    const vendorDir = upath.join(upath.dirname(goModFileName), 'vendor/');
    const vendorModulesFileName = upath.join(vendorDir, 'modules.txt');
    // istanbul ignore if
    if (await platform.getFile(vendorModulesFileName)) {
      if (config.gitFs) {
        args = 'mod vendor';
        if (cmd.includes('.insteadOf')) {
          args += '"';
        }
        logger.debug({ cmd, args }, 'go mod vendor command');
        ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
          cwd,
          shell: true,
          env,
        }));
        duration = process.hrtime(startTime);
        seconds = Math.round(duration[0] + duration[1] / 1e9);
        logger.info({ seconds, stdout, stderr }, 'Vendored modules');
        const status = await platform.getRepoStatus();
        for (const modified of status.modified) {
          if (modified.startsWith(vendorDir)) {
            const localModified = upath.join(config.localDir, modified);
            res.push({
              file: {
                name: modified,
                contents: await fs.readFile(localModified, 'utf8'),
              },
            });
          }
        }
      } else {
        logger.warn(
          'Vendor modules found - Renovate administrator should enable gitFs in order to update them'
        );
      }
    }
    return res;
  } catch (err) {
    logger.info({ err }, 'Failed to update go.sum');
    return [
      {
        artifactError: {
          lockFile: sumFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
