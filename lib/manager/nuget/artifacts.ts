import { join } from 'path';
import { id } from '../../datasource/nuget';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  ensureCacheDir,
  getSiblingFileName,
  readLocalFile,
  remove,
  writeLocalFile,
} from '../../util/fs';
import * as hostRules from '../../util/host-rules';
import {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../common';
import { determineRegistries, getRandomString } from './util';

async function addSourceCmds(
  packageFileName: string,
  config: UpdateArtifactsConfig,
  nugetConfigFile: string
): Promise<string[]> {
  const registries = (
    (await determineRegistries(packageFileName, config.localDir)) || []
  ).filter((registry) => registry.name != null);
  const result = [];
  for (const registry of registries) {
    const { username, password } = hostRules.find({
      hostType: id,
      url: registry.url,
    });
    let addSourceCmd = `dotnet nuget add source ${registry.url} --name ${registry.name} --configfile ${nugetConfigFile}`;
    if (username && password) {
      // Add registry credentials from host rules.
      addSourceCmd += ` --username ${username} --password ${password} --store-password-in-clear-text`;
    }
    result.push(addSourceCmd);
  }
  return result;
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

  const nugetConfigDir = await ensureCacheDir(
    `./others/nuget/${getRandomString()}`
  );
  const nugetConfigFile = join(nugetConfigDir, 'nuget.config');
  const cmds = [
    `dotnet new nugetconfig --output ${nugetConfigDir}`,
    ...(await addSourceCmds(packageFileName, config, nugetConfigFile)),
    `dotnet restore ${packageFileName} --force-evaluate --configfile ${nugetConfigFile}`,
  ];
  logger.debug({ cmd: cmds }, 'dotnet command');
  await exec(cmds, execOptions);
  await remove(nugetConfigDir);
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
