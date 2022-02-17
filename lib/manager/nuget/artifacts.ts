import { join } from 'path';
import { quote } from 'shlex';
import { GlobalConfig } from '../../config/global';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { NugetDatasource } from '../../datasource/nuget';
import { parseRegistryUrl } from '../../datasource/nuget/common';
import { logger } from '../../logger';
import { exec } from '../../util/exec';
import type { ExecOptions } from '../../util/exec/types';
import {
  ensureCacheDir,
  getSiblingFileName,
  outputFile,
  readLocalFile,
  remove,
  writeLocalFile,
} from '../../util/fs';
import * as hostRules from '../../util/host-rules';
import { regEx } from '../../util/regex';
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
import { getDependentPackageFiles } from './package-tree';

async function addSourceCmds(
  packageFileName: string,
  config: UpdateArtifactsConfig,
  nugetConfigFile: string
): Promise<string[]> {
  const { localDir } = GlobalConfig.get();
  const registries =
    (await getConfiguredRegistries(packageFileName, localDir)) ||
    getDefaultRegistries();
  const result = [];
  for (const registry of registries) {
    const { username, password } = hostRules.find({
      hostType: NugetDatasource.id,
      url: registry.url,
    });
    const registryInfo = parseRegistryUrl(registry.url);
    let addSourceCmd = `dotnet nuget add source ${registryInfo.feedUrl} --configfile ${nugetConfigFile}`;
    if (registry.name) {
      // Add name for registry, if known.
      addSourceCmd += ` --name ${quote(registry.name)}`;
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
  dependentPackageFileNames: [string],
  config: UpdateArtifactsConfig
): Promise<void> {
  const execOptions: ExecOptions = {
    docker: {
      image: 'dotnet',
    },
  };
  const nugetCacheDir = await ensureCacheDir('nuget');
  const nugetConfigDir = join(nugetCacheDir, `${getRandomString()}`);
  const nugetConfigFile = join(nugetConfigDir, `nuget.config`);
  await outputFile(
    nugetConfigFile,
    `<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n</configuration>\n`
  );

  const cmds = [
    ...(await addSourceCmds(packageFileName, config, nugetConfigFile)),
    ...dependentPackageFileNames.map(
      (f) =>
        `dotnet restore ${f} --force-evaluate --configfile ${nugetConfigFile}`
    ),
  ];

  logger.info({ cmd: cmds }, 'dotnet command');
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

  if (!regEx(/(?:cs|vb|fs)proj$/i).test(packageFileName)) {
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

  const packageFiles = (await getDependentPackageFiles(packageFileName)).concat(
    packageFileName
  );
  const lockFileNames = packageFiles.map((f) =>
    getSiblingFileName(f, 'packages.lock.json')
  );
  const existingLockFileContentMap = await lockFileNames.reduce(
    async (a, v) => ({ ...a, [v]: await readLocalFile(v, 'utf8') }),
    {}
  );

  // TODO: confirm this logic works
  const hasLockFileContent = Object.keys(existingLockFileContentMap).reduce(
    (a, k) => a || existingLockFileContentMap[k],
    false
  );
  if (!hasLockFileContent) {
    logger.info(
      { packageFileName },
      'No lock file found for package or dependents'
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

    await runDotnetRestore(packageFileName, packageFiles, config);

    const newLockFileContentMap = await lockFileNames.reduce(
      async (a, v) => ({ ...a, [v]: await readLocalFile(v, 'utf8') }),
      {}
    );

    const retArray = [];
    for (const lockFileName of lockFileNames) {
      if (
        existingLockFileContentMap[lockFileName] !==
        newLockFileContentMap[lockFileName]
      ) {
        retArray.push({
          file: {
            type: 'addition',
            path: lockFileName,
            contents: newLockFileContentMap[lockFileName],
          },
        });
      } else {
        logger.info(`Lock file ${lockFileName} is unchanged`);
      }
    }

    logger.debug('Returning updated lock files');
    return retArray.length > 0 ? retArray : null;
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
