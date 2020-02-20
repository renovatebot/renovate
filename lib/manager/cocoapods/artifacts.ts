import upath from 'upath';
import fs from 'fs-extra';
import { hrtime } from 'process';
import { platform } from '../../platform';
import { exec, ExecOptions } from '../../util/exec';
import { logger } from '../../logger';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';
import { getPkgReleases } from '../../datasource/docker';
import { get as getVersioning } from '../../versioning';
import { readLocalFile } from '../../util/fs';

async function getImageTag(
  lookupName: string,
  versionScheme: string,
  constraint?: string | null
): Promise<string> {
  const releases = await getPkgReleases({
    lookupName,
  });
  let result = 'latest';
  if (releases && releases.releases) {
    const versioning = getVersioning(versionScheme);
    const allVersions: string[] = releases.releases.map(
      release => release.version
    );
    let versions = allVersions.filter(version => versioning.isVersion(version));
    if (constraint) {
      versions = versions.filter(version =>
        versioning.matches(version, constraint)
      );
    }
    versions = versions.sort((a, b) => versioning.sortVersions(a, b));

    if (constraint && versions.length) {
      result = versions[versions.length - 1];
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

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`cocoapods.getArtifacts(${packageFileName})`);

  if (updatedDeps.length < 1) {
    logger.debug('CocoaPods: empty update - returning null');
    return null;
  }

  if (!config.localDir) {
    logger.debug('CocoaPods: no local dir specified');
    return null;
  }

  const packageFileAbsolutePath = upath.join(config.localDir, packageFileName);

  const lockFileName = upath.join(
    upath.dirname(packageFileName),
    'Podfile.lock'
  );

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

  const match = new RegExp(/^COCOAPODS: (?<cocoapodsVersion>.*)$/m).exec(
    existingLockFileContent
  );
  const cocoapodsVersion =
    match && match.groups ? match.groups.cocoapodsVersion : null;

  const cmd = 'pod install';
  const execOptions: ExecOptions = {
    docker: {
      image: 'renovate/cocoapods',
      tag: await getImageTag('renovate/cocoapods', 'ruby', cocoapodsVersion),
    },
  };
  await exec(cmd, execOptions);
  const status = await platform.getRepoStatus();
  if (!status.modified.includes(lockFileName)) {
    return null;
  }
  logger.debug('Returning updated Gemfile.lock');
  const lockFileContent = await readLocalFile(lockFileName);
  return [
    {
      file: {
        name: lockFileName,
        contents: lockFileContent,
      },
    },
  ];
}
