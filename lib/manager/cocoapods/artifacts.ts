import upath from 'upath';
import fs from 'fs-extra';
import { hrtime } from 'process';
import { platform } from '../../platform';
import { exec } from '../../util/exec';
import { logger } from '../../logger';
import { UpdateArtifactsConfig, UpdateArtifactsResult } from '../common';
import { getPkgReleases } from '../../datasource/docker';
import { get as getVersioning } from '../../versioning';

async function getImageTag(
  lookupName: string,
  versionScheme: string,
  constraint?: string
): Promise<string> {
  const releases = await getPkgReleases({
    lookupName,
  });
  let result = 'latest';
  if (releases && releases.releases) {
    const versioning = getVersioning(versionScheme);
    let versions = releases.releases.map(release => release.version);
    versions = versions.filter(version => versioning.isVersion(version));
    if (constraint) {
      versions = versions.filter(version =>
        versioning.matches(version, constraint)
      );
    }
    versions = versions.sort(versioning.sortVersions);
    if (versions.length) {
      result = versions.pop();
    }
  }
  if (result === 'latest') {
    logger.warn(
      { constraint },
      'Failed to find a tag satisfying the constraint, using latest image instead'
    );
  }
  return result;
}

export async function updateArtifacts(
  packageFileName: string,
  updatedDeps: string[],
  newPackageFileContent: string,
  config: UpdateArtifactsConfig
): Promise<UpdateArtifactsResult[] | null> {
  await logger.debug(`cocoapods.getArtifacts(${packageFileName})`);

  if (updatedDeps.length < 1) {
    logger.debug('CocoaPods: empty update - returning null');
    return null;
  }

  if (!config.localDir) {
    logger.debug('CocoaPods: no local dir specified');
    return null;
  }

  const packageFileAbsolutePath = upath.join(config.localDir, packageFileName);
  const cwd = upath.dirname(packageFileAbsolutePath);

  const lockFileName = upath.join(
    upath.dirname(packageFileName),
    'Podfile.lock'
  );
  const lockFileAbsolutePath = upath.join(cwd, 'Podfile.lock');

  try {
    await fs.outputFile(packageFileAbsolutePath, newPackageFileContent);
  } catch (err) {
    logger.warn({ err }, 'Podfile could not be written');
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug(`Lockfile not found: ${lockFileName}`);
    return null;
  }

  const cmdParts = [];
  let cocoapodsVersion: string = null;
  if (config.binarySource === 'docker') {
    cmdParts.push('docker run --rm');

    if (config.dockerUser) cmdParts.push(`--user=${config.dockerUser}`);

    cmdParts.push(`-v ${cwd}:${cwd}`);
    cmdParts.push(`-w ${cwd}`);
    cmdParts.push(`--entrypoint pod`);

    const match = existingLockFileContent.match(
      /^COCOAPODS: (?<cocoapodsVersion>.*)$/m
    );
    cocoapodsVersion = match ? match.groups.cocoapodsVersion : null;
    const imageName = 'renovate/cocoapods';
    const imageTag = await getImageTag(imageName, 'ruby', cocoapodsVersion);
    cmdParts.push(`${imageName}:${imageTag}`);
  } else {
    cmdParts.push('pod');
  }
  cmdParts.push('install');

  const startTime = hrtime();
  let execResult = null;
  let execError = null;
  /* istanbul ignore next */
  try {
    const command = cmdParts.join(' ');
    execResult = await exec(command, { cwd });
  } catch (err) {
    execError = err;
  }

  const duration = hrtime(startTime);
  const seconds = Math.round(duration[0] + duration[1] / 1e9);
  logger.info({ seconds, type: 'Podfile.lock' }, 'Updated lockfile');
  logger.debug(`Returning updated lockfile: ${lockFileName}`);

  let newPodfileLockContent = null;
  try {
    newPodfileLockContent = await fs.readFile(lockFileAbsolutePath, 'utf8');
  } catch (readError) {
    const err = execError || readError;
    logger.warn(
      { err, message: err.message },
      `Failed to update lockfile: ${lockFileName}`
    );

    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  if (newPodfileLockContent === existingLockFileContent) {
    if (execError) {
      const err = execError;
      logger.warn(
        { err, message: err.message },
        `Failed to update lockfile: ${lockFileName}`
      );

      return [
        {
          artifactError: {
            lockFile: lockFileName,
            stderr: err.message,
          },
        },
      ];
    }

    if (execResult && execResult.stderr) {
      return [
        {
          artifactError: {
            lockFile: lockFileName,
            stderr: execResult.stderr,
          },
        },
      ];
    }

    logger.debug(`${lockFileName} is unchanged`);
    return null;
  }

  return [
    {
      file: {
        name: lockFileName,
        contents: newPodfileLockContent,
      },
    },
  ];
}
