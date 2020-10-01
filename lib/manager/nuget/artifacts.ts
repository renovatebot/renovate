import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
// import { regEx } from '../../util/regex';
// import * as hostRules from '../../util/host-rules';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';

async function auth(): Promise<void> {
  // const authJson = {};
  // let credentials = hostRules.find({
  //   hostType: PLATFORM_TYPE_GITHUB,
  //   url: 'https://api.github.com/',
  // });
  // // istanbul ignore if
  // if (credentials?.token) {
  //   authJson['github-oauth'] = {
  //     'github.com': credentials.token,
  //   };
  // }
  // credentials = hostRules.find({
  //   hostType: PLATFORM_TYPE_GITLAB,
  //   url: 'https://gitlab.com/api/v4/',
  // });
  // // istanbul ignore if
  // if (credentials?.token) {
  //   authJson['gitlab-token'] = {
  //     'gitlab.com': credentials.token,
  //   };
  // }
  // try {
  //   // istanbul ignore else
  //   if (is.array(config.registryUrls)) {
  //     for (const regUrl of config.registryUrls) {
  //       if (regUrl) {
  //         const { host } = URL.parse(regUrl);
  //         const hostRule = hostRules.find({
  //           hostType: datasourcePackagist.id,
  //           url: regUrl,
  //         });
  //         // istanbul ignore else
  //         if (hostRule.username && hostRule.password) {
  //           logger.debug('Setting packagist auth for host ' + host);
  //           authJson['http-basic'] = authJson['http-basic'] || {};
  //           authJson['http-basic'][host] = {
  //             username: hostRule.username,
  //             password: hostRule.password,
  //           };
  //         } else {
  //           logger.debug('No packagist auth found for ' + regUrl);
  //         }
  //       }
  //     }
  //   } else if (config.registryUrls) {
  //     logger.warn(
  //       { registryUrls: config.registryUrls },
  //       'Non-array composer registryUrls'
  //     );
  //   }
  // } catch (err) /* istanbul ignore next */ {
  //   logger.warn({ err }, 'Error setting registryUrls auth for composer');
  // }
  // if (authJson) {
  //   await writeLocalFile('auth.json', JSON.stringify(authJson));
  // }
  // TODO: Find package sources, log in to them using information from host rules.
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
    await auth();

    if (updatedDeps.length === 0 && config.isLockFileMaintenance !== true) {
      logger.debug(`Not updating lock file because no deps changed.`);
      return null;
    }

    await writeLocalFile(packageFileName, newPackageFileContent);

    const cmd = 'dotnet restore --force-evaluate';
    logger.debug({ cmd }, 'dotnet command');
    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {
        image: 'renovate/dotnet',
      },
    };
    await exec(cmd, execOptions);
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
