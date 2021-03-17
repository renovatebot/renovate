import { join } from 'path';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { id, parseRegistryUrl } from '../../datasource/nuget';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  ensureCacheDir,
  getSiblingFileName,
  outputFile,
  readLocalFile,
  remove,
  writeLocalFile,
} from '../../util/fs';
import * as hostRules from '../../util/host-rules';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';
import {
  getConfiguredRegistries,
  getDefaultRegistries,
  getRandomString,
} from './util';

async function addSourceCmds(
  packageFileName: string,
  config: UpdateArtifactsConfig,
  nugetConfigFile: string
): Promise<string[]> {
  const registries =
    (await getConfiguredRegistries(packageFileName, config.localDir)) ||
    getDefaultRegistries();
  const result = [];
  for (const registry of registries) {
    const { username, password } = hostRules.find({
      hostType: id,
      url: registry.url,
    });
    const registryInfo = parseRegistryUrl(registry.url);
    let addSourceCmd = `dotnet nuget add source ${registryInfo.feedUrl} --configfile ${nugetConfigFile}`;
    if (registry.name) {
      // Add name for registry, if known.
      addSourceCmd += ` --name ${registry.name}`;
    }
    if (username && password) {
      // Add registry credentials from host rules, if configured.
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
      image: 'dotnet',
    },
  };

  const nugetConfigDir = await ensureCacheDir(
    `./others/nuget/${getRandomString()}`
  );
  const nugetConfigFile = join(nugetConfigDir, 'nuget.config');
  await outputFile(
    nugetConfigFile,
    `<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n</configuration>\n`
  );
  const cmds = [
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
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
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
