import is from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
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
    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      toolConstraints: [
        { toolName: 'vendir', constraint: config.constraints?.vendir },
        { toolName: 'helm', constraint: config.constraints?.helm },
      ],
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
      // Files must be in the vendor path to get added
      const vendorDir = getSiblingFileName(packageFileName, './');
      const status = await getRepoStatus();
      for (const f of status.modified.concat(status.not_added)) {
        if (f.startsWith(vendorDir)) {
          fileChanges.push({
            file: {
              type: 'addition',
              path: f,
              contents: await readLocalFile(f),
            },
          });
        }
      }
      for (const f of status.deleted ?? []) {
        fileChanges.push({
          file: {
            type: 'deletion',
            path: f,
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
