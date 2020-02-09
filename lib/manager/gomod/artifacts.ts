import { ensureDir } from 'fs-extra';
import { join, dirname } from 'upath';
import { exec, ExecOptions } from '../../util/exec';
import { find } from '../../util/host-rules';
import { logger } from '../../logger';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';
import { platform } from '../../platform';
import { BinarySource } from '../../util/exec/common';
import { readLocalFile, writeLocalFile } from '../../util/fs';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';

function getPreCommands(): string[] | null {
  const credentials = find({
    hostType: 'github',
    url: 'https://api.github.com/',
  });
  let preCommands = null;
  if (credentials && credentials.token) {
    const token = global.appMode
      ? `x-access-token:${credentials.token}`
      : credentials.token;
    preCommands = [
      `git config --global url.\\\\"https://${token}@github.com/\\\\".insteadOf \\\\"https://github.com/\\\\"`,
    ];
  }
  return preCommands;
}

export async function updateArtifacts({
  packageFileName: goModFileName,
  updatedDeps: _updatedDeps,
  newPackageFileContent: newGoModContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`gomod.updateArtifacts(${goModFileName})`);

  const goPath = process.env.GOPATH || join(config.cacheDir, './others/go');
  await ensureDir(goPath);
  logger.debug(`Using GOPATH: ${goPath}`);

  const sumFileName = goModFileName.replace(/\.mod$/, '.sum');
  const existingGoSumContent = await platform.getFile(sumFileName);
  if (!existingGoSumContent) {
    logger.debug('No go.sum found');
    return null;
  }
  try {
    const massagedGoMod = newGoModContent.replace(
      /\n(replace\s+[^\s]+\s+=>\s+\.\.\/.*)/g,
      '\n// renovate-replace $1'
    );
    if (massagedGoMod !== newGoModContent) {
      logger.debug('Removed some relative replace statements from go.mod');
    }
    await writeLocalFile(goModFileName, massagedGoMod);
    const cmd = 'go';
    const execOptions: ExecOptions = {
      cwd: join(config.localDir, dirname(goModFileName)),
      extraEnv: {
        GOPATH: goPath,
        GOPROXY: process.env.GOPROXY,
        GONOSUMDB: process.env.GONOSUMDB,
        CGO_ENABLED: config.binarySource === BinarySource.Docker ? '0' : null,
      },
      docker: {
        image: 'renovate/go',
        volumes: [goPath],
        preCommands: getPreCommands(),
      },
    };
    let args = 'get -d ./...';
    logger.debug({ cmd, args }, 'go get command');
    await exec(`${cmd} ${args}`, execOptions);
    if (
      config.postUpdateOptions &&
      config.postUpdateOptions.includes('gomodTidy')
    ) {
      args = 'mod tidy';
      logger.debug({ cmd, args }, 'go mod tidy command');
      await exec(`${cmd} ${args}`, execOptions);
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
        contents: await readLocalFile(sumFileName),
      },
    });
    const vendorDir = join(dirname(goModFileName), 'vendor/');
    const vendorModulesFileName = join(vendorDir, 'modules.txt');
    // istanbul ignore if
    if (await platform.getFile(vendorModulesFileName)) {
      args = 'mod vendor';
      logger.debug({ cmd, args }, 'go mod vendor command');
      await exec(`${cmd} ${args}`, execOptions);
      if (
        config.postUpdateOptions &&
        config.postUpdateOptions.includes('gomodTidy')
      ) {
        args = 'mod tidy';
        if (cmd.includes('.insteadOf')) {
          args += '"';
        }
        logger.debug({ cmd, args }, 'go mod tidy command');
        await exec(`${cmd} ${args}`, execOptions);
      }
      status = await platform.getRepoStatus();
      for (const f of status.modified.concat(status.not_added)) {
        if (f.startsWith(vendorDir)) {
          res.push({
            file: {
              name: f,
              contents: await readLocalFile(f),
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
    const finalGoModContent = (await readLocalFile(goModFileName)).replace(
      /\/\/ renovate-replace /g,
      ''
    );
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
