import is from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { isFileInDir } from './utils';

async function vendirCommands(execOptions: ExecOptions): Promise<void> {
  const cmd: string[] = [];

  cmd.push(`vendir sync`);

  await exec(cmd, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`vendir.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';
  const isUpdateOptionAddVendirArchives = config.postUpdateOptions?.includes(
    'vendirUpdateSubChartArchives'
  );

  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated vendir deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'vendir.lock.yml');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent && !isUpdateOptionAddVendirArchives) {
    logger.debug('No vendir.lock.yml found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating Vendir artifacts');
    const vendirToolConstraint: ToolConstraint = {
      toolName: 'vendir',
      constraint: config.constraints?.helm,
    };

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      toolConstraints: [vendirToolConstraint],
    };
    await vendirCommands(execOptions);
    logger.debug('Returning updated Vendir artifacts');

    const fileChanges: UpdateArtifactsResult[] = [];

    if (is.truthy(existingLockFileContent)) {
      const newVendirLockContent = await readLocalFile(lockFileName, 'utf8');
      const isLockFileChanged =
        existingLockFileContent !== newVendirLockContent;
      if (isLockFileChanged) {
        fileChanges.push({
          file: {
            type: 'addition',
            path: lockFileName,
            contents: newVendirLockContent,
          },
        });
      } else {
        logger.debug('vendir.lock.yml is unchanged');
      }
    }

    // add modified vendir archives to artifacts
    if (is.truthy(isUpdateOptionAddVendirArchives)) {
      const vendirPath = getSiblingFileName(
        packageFileName,
        getParentDir(packageFileName)
      );
      const status = await getRepoStatus();
      const vendirAddition = status.not_added ?? [];
      const vendirDeletion = status.deleted ?? [];

      for (const file of vendirAddition) {
        // only add artifacts in the vendir sub path
        if (!isFileInDir(vendirPath, file)) {
          continue;
        }
        fileChanges.push({
          file: {
            type: 'addition',
            path: file,
            contents: await readLocalFile(file),
          },
        });
      }

      for (const file of vendirDeletion) {
        // only add artifacts in the vendir sub path
        if (!isFileInDir(vendirPath, file)) {
          continue;
        }
        fileChanges.push({
          file: {
            type: 'deletion',
            path: file,
          },
        });
      }
    }

    return fileChanges.length > 0 ? fileChanges : null;
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update Vendir lock file');
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
