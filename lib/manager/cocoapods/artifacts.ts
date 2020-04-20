import { join, dirname } from 'upath';
import { platform } from '../../platform';
import { exec, ExecOptions } from '../../util/exec';
import { logger } from '../../logger';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';

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

  const lockFileName = getSiblingFileName(packageFileName, 'Podfile.lock');

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
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
  const tagConstraint =
    match && match.groups ? match.groups.cocoapodsVersion : null;

  const cmd = 'pod install';
  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    docker: {
      image: 'renovate/cocoapods',
      tagScheme: 'ruby',
      tagConstraint,
    },
  };

  try {
    await exec(cmd, execOptions);
  } catch (err) {
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.stderr || err.stdout || err.message,
        },
      },
    ];
  }

  const status = await platform.getRepoStatus();
  if (!status.modified.includes(lockFileName)) {
    return null;
  }
  logger.debug(`Returning updated lockfile: ${lockFileName}`);
  const lockFileContent = await readLocalFile(lockFileName);
  const res: UpdateArtifactsResult[] = [
    {
      file: {
        name: lockFileName,
        contents: lockFileContent,
      },
    },
  ];

  const podsDir = join(dirname(packageFileName), 'Pods');
  const podsManifestFileName = join(podsDir, 'Manifest.lock');
  if (await platform.getFile(podsManifestFileName)) {
    for (const f of status.modified.concat(status.not_added)) {
      if (f.startsWith(podsDir)) {
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

  return res;
}
