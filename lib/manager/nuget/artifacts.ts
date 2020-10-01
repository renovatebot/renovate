import { id } from '../../datasource/nuget';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import * as hostRules from '../../util/host-rules';
import {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../common';
import { determineRegistries } from './util';

async function authenticate(
  packageFileName: string,
  config: UpdateArtifactsConfig,
  cmds: string[]
): Promise<void> {
  const registries = (
    (await determineRegistries(packageFileName, config.localDir)) || []
  ).filter((registry) => registry.name != null);
  for (const registry of registries) {
    const { username, password } = hostRules.find({
      hostType: id,
      url: registry.url,
    });
    if (username && password) {
      cmds.unshift(
        `dotnet nuget update source ${registry.name} --username ${username} --password ${password} --store-password-in-clear-text`
      );
      cmds.push(
        `dotnet nuget update source ${registry.name} --username '' --password '' --store-password-in-clear-text`
      );
    }
  }
}

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  config,
  updatedDeps,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`nuget.updateArtifacts(${packageFileName})`);

  // TODO: Make this work when non-project files are changed (e.g. '.props')
  // // eslint-disable-next-line no-useless-escape
  // if (regEx('.*.[cs|vb|fs]proj$', 'i').test(packageFileName)) {
  //   logger.debug('Not updating lock file');
  //   return null;
  // }

  // TODO: Make this work with central package version handling where there is just a single lock file.

  const lockFileName = getSiblingFileName(
    packageFileName,
    'packages.lock.json'
  );
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No lock file found');
    return null;
  }

  try {
    if (updatedDeps.length === 0 && config.isLockFileMaintenance !== true) {
      logger.debug(`Not updating lock file because no deps changed.`);
      return null;
    }

    await writeLocalFile(packageFileName, newPackageFileContent);

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {
        image: 'renovate/dotnet',
      },
    };

    const cmds = ['dotnet restore --force-evaluate'];

    await authenticate(packageFileName, config, cmds);

    logger.debug({ cmd: cmds }, 'dotnet command');
    await exec(cmds, execOptions);
    const newLockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (existingLockFileContent === newLockFileContent) {
      logger.debug(`Lock file is unchanged`);
      return null;
    }
    logger.debug('Returning updated lock file');
    return [
      {
        file: {
          name: lockFileName,
          contents: await readLocalFile(lockFileName),
        },
      },
    ];
  } catch (err) {
    logger.debug({ err }, 'Failed to generate lock file');
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
