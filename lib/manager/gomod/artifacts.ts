import { quote } from 'shlex';
import { dirname, join } from 'upath';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import { BinarySource } from '../../util/exec/common';
import { ensureCacheDir, readLocalFile, writeLocalFile } from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import { find } from '../../util/host-rules';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

function getPreCommands(): string[] | null {
  const credentials = find({
    hostType: PLATFORM_TYPE_GITHUB,
    url: 'https://api.github.com/',
  });
  let preCommands = null;
  if (credentials?.token) {
    const token = quote(credentials.token);
    preCommands = [
      `git config --global url.\"https://${token}@github.com/\".insteadOf \"https://github.com/\"`, // eslint-disable-line no-useless-escape
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

  const goPath = await ensureCacheDir('./others/go', 'GOPATH');
  logger.debug(`Using GOPATH: ${goPath}`);

  const sumFileName = goModFileName.replace(/\.mod$/, '.sum');
  const existingGoSumContent = await readLocalFile(sumFileName);
  if (!existingGoSumContent) {
    logger.debug('No go.sum found');
    return null;
  }

  const vendorDir = join(dirname(goModFileName), 'vendor/');
  const vendorModulesFileName = join(vendorDir, 'modules.txt');
  const useVendor = (await readLocalFile(vendorModulesFileName)) !== null;

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
      cwdFile: goModFileName,
      extraEnv: {
        GOPATH: goPath,
        GOPROXY: process.env.GOPROXY,
        GOPRIVATE: process.env.GOPRIVATE,
        GONOPROXY: process.env.GONOPROXY,
        GONOSUMDB: process.env.GONOSUMDB,
        CGO_ENABLED: config.binarySource === BinarySource.Docker ? '0' : null,
      },
      docker: {
        image: 'go',
        tagConstraint: config.constraints?.go,
        tagScheme: 'npm',
        volumes: [goPath],
        preCommands: getPreCommands(),
      },
    };
    let args = 'get -d ./...';
    logger.debug({ cmd, args }, 'go get command included');
    const execCommands = [`${cmd} ${args}`];

    if (config.postUpdateOptions?.includes('gomodTidy')) {
      args = 'mod tidy';
      logger.debug({ cmd, args }, 'go mod tidy command included');
      execCommands.push(`${cmd} ${args}`);
    }

    if (useVendor) {
      args = 'mod vendor';
      logger.debug({ cmd, args }, 'go mod vendor command included');
      execCommands.push(`${cmd} ${args}`);
      if (config.postUpdateOptions?.includes('gomodTidy')) {
        args = 'mod tidy';
        logger.debug({ cmd, args }, 'go mod tidy command included');
        execCommands.push(`${cmd} ${args}`);
      }
    }

    // We tidy one more time as a solution for #6795
    if (config.postUpdateOptions?.includes('gomodTidy')) {
      args = 'mod tidy';
      logger.debug({ cmd, args }, 'additional go mod tidy command included');
      execCommands.push(`${cmd} ${args}`);
    }

    await exec(execCommands, execOptions);

    const status = await getRepoStatus();
    if (!status.modified.includes(sumFileName)) {
      return null;
    }

    logger.debug('Returning updated go.sum');
    const res: UpdateArtifactsResult[] = [
      {
        file: {
          name: sumFileName,
          contents: await readLocalFile(sumFileName),
        },
      },
    ];

    if (useVendor) {
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

    const finalGoModContent = (
      await readLocalFile(goModFileName, 'utf8')
    ).replace(/\/\/ renovate-replace /g, '');
    if (finalGoModContent !== newGoModContent) {
      logger.debug('Found updated go.mod after go.sum update');
      res.push({
        file: {
          name: goModFileName,
          contents: finalGoModContent,
        },
      });
    }
    return res;
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update go.sum');
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
