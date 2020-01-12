import { ensureDir, outputFile, readFile } from 'fs-extra';
import { join, dirname } from 'upath';
import { exec } from '../../util/exec';
import { find } from '../../util/host-rules';
import { getChildProcessEnv } from '../../util/exec/env';
import { logger } from '../../logger';
import { UpdateArtifactsConfig, UpdateArtifactsResult } from '../common';
import { platform } from '../../platform';

export async function updateArtifacts(
  goModFileName: string,
  _updatedDeps: string[],
  newGoModContent: string,
  config: UpdateArtifactsConfig
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`gomod.updateArtifacts(${goModFileName})`);
  const customEnv = ['GOPATH', 'GOPROXY', 'GONOSUMDB'];
  const env = getChildProcessEnv(customEnv);
  env.GOPATH = env.GOPATH || join(config.cacheDir, './others/go');
  await ensureDir(env.GOPATH);
  logger.debug('Using GOPATH: ' + env.GOPATH);
  const sumFileName = goModFileName.replace(/\.mod$/, '.sum');
  const existingGoSumContent = await platform.getFile(sumFileName);
  if (!existingGoSumContent) {
    logger.debug('No go.sum found');
    return null;
  }
  const cwd = join(config.localDir, dirname(goModFileName));
  let stdout: string;
  let stderr: string;
  try {
    const localGoModFileName = join(config.localDir, goModFileName);
    const massagedGoMod = newGoModContent.replace(
      /\n(replace\s+[^\s]+\s+=>\s+\.\.\/.*)/g,
      '\n// renovate-replace $1'
    );
    if (massagedGoMod !== newGoModContent) {
      logger.debug('Removed some relative replace statements from go.mod');
    }
    await outputFile(localGoModFileName, massagedGoMod);
    const localGoSumFileName = join(config.localDir, sumFileName);
    const startTime = process.hrtime();
    let cmd: string;
    if (config.binarySource === 'docker') {
      logger.info('Running go via docker');
      cmd = `docker run --rm `;
      if (config.dockerUser) {
        cmd += `--user=${config.dockerUser} `;
      }
      const volumes = [config.localDir, env.GOPATH];
      cmd += volumes.map(v => `-v "${v}":"${v}" `).join('');
      const envVars = customEnv;
      cmd += envVars.map(e => `-e ${e} `).join('');
      cmd += '-e CGO_ENABLED=0 ';
      cmd += `-w "${cwd}" `;
      cmd += `renovate/go `;
      const credentials = find({
        hostType: 'github',
        url: 'https://api.github.com/',
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
    } else if (
      config.binarySource === 'auto' ||
      config.binarySource === 'global'
    ) {
      logger.info('Running go via global command');
      cmd = 'go';
    } else {
      logger.warn({ config }, 'Unsupported binarySource');
      cmd = 'go';
    }
    let args = 'get -d ./...';
    if (cmd.includes('.insteadOf')) {
      args += '"';
    }
    logger.debug({ cmd, args }, 'go get command');
    ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
      cwd,
      env,
    }));
    let duration = process.hrtime(startTime);
    let seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: 'go.sum', stdout, stderr },
      'Generated lockfile'
    );
    if (
      config.postUpdateOptions &&
      config.postUpdateOptions.includes('gomodTidy')
    ) {
      args = 'mod tidy';
      if (cmd.includes('.insteadOf')) {
        args += '"';
      }
      logger.debug({ cmd, args }, 'go mod tidy command');
      ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
        cwd,
        env,
      }));
      duration = process.hrtime(startTime);
      seconds = Math.round(duration[0] + duration[1] / 1e9);
      logger.info(
        { seconds, stdout, stderr },
        'Tidied Go Modules after update'
      );
    }
    const res = [];
    let status = await platform.getRepoStatus();
    if (!status.modified.includes(sumFileName)) {
      return null;
    }
    logger.debug('Returning updated go.sum');
    res.push({
      file: {
        name: sumFileName,
        contents: await readFile(localGoSumFileName, 'utf8'),
      },
    });
    const vendorDir = join(dirname(goModFileName), 'vendor/');
    const vendorModulesFileName = join(vendorDir, 'modules.txt');
    // istanbul ignore if
    if (await platform.getFile(vendorModulesFileName)) {
      args = 'mod vendor';
      if (cmd.includes('.insteadOf')) {
        args += '"';
      }
      logger.debug({ cmd, args }, 'go mod vendor command');
      ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
        cwd,
        env,
      }));
      duration = process.hrtime(startTime);
      seconds = Math.round(duration[0] + duration[1] / 1e9);
      logger.info({ seconds, stdout, stderr }, 'Vendored modules');
      if (
        config.postUpdateOptions &&
        config.postUpdateOptions.includes('gomodTidy')
      ) {
        args = 'mod tidy';
        if (cmd.includes('.insteadOf')) {
          args += '"';
        }
        logger.debug({ cmd, args }, 'go mod tidy command');
        ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
          cwd,
          env,
        }));
        duration = process.hrtime(startTime);
        seconds = Math.round(duration[0] + duration[1] / 1e9);
        logger.info(
          { seconds, stdout, stderr },
          'Tidied Go Modules after vendoring'
        );
      }
      status = await platform.getRepoStatus();
      for (const f of status.modified.concat(status.not_added)) {
        if (f.startsWith(vendorDir)) {
          const localModified = join(config.localDir, f);
          res.push({
            file: {
              name: f,
              contents: await readFile(localModified, 'utf8'),
            },
          });
        }
      }
      for (const f of status.deleted || []) {
        res.push({
          file: {
            name: '|delete|',
            contents: f,
          },
        });
      }
    }
    const finalGoModContent = (await readFile(
      localGoModFileName,
      'utf8'
    )).replace(/\/\/ renovate-replace /g, '');
    if (finalGoModContent !== newGoModContent) {
      logger.info('Found updated go.mod after go.sum update');
      res.push({
        file: {
          name: goModFileName,
          contents: finalGoModContent,
        },
      });
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
