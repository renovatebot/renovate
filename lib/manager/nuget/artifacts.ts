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
      // Add registry credentials from host rules.
      cmds.unshift(
        `dotnet nuget update source ${registry.name} --username ${username} --password ${password} --store-password-in-clear-text`
      );
      // Ensure that credentials are removed as soon as not necessary anymore.
      cmds.push(
        `dotnet nuget update source ${registry.name} --username '' --password '' --store-password-in-clear-text`
      );
    }
  }
}

async function runDotnetRestore(
  packageFileName: string,
  config: UpdateArtifactsConfig
): Promise<void> {
  const execOptions: ExecOptions = {
    docker: {
      image: 'renovate/dotnet',
    },
  };
  const cmds = [`dotnet restore ${packageFileName} --force-evaluate`];
  await authenticate(packageFileName, config, cmds);
  logger.debug({ cmd: cmds }, 'dotnet command');
  await exec(cmds, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  config,
  updatedDeps,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`nuget.updateArtifacts(${packageFileName})`);

  if (!/(?:cs|vb|fs)proj$/i.test(packageFileName)) {
    // This could be implemented in the future if necessary.
    // It's not that easy though because the questions which
    // project file to restore how to determine which lock files
    // have been changed in such cases.
    logger.debug(
      { packageFileName },
      'Not updating lock file for non project files'
    );
    return null;
  }

  const lockFileName = getSiblingFileName(
    packageFileName,
    'packages.lock.json'
  );
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug(
      { packageFileName },
      'No lock file found beneath package file.'
    );
    return null;
  }

  try {
    if (updatedDeps.length === 0 && config.isLockFileMaintenance !== true) {
      logger.debug(
        `Not updating lock file because no deps changed and no lock file maintenance.`
      );
      return null;
    }

    await writeLocalFile(packageFileName, newPackageFileContent);

    await runDotnetRestore(packageFileName, config);

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
