import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`vendir.updateArtifacts(${packageFileName})`);

  const lockFileName = getSiblingFileName(packageFileName, 'vendir.lock.yml');
  if (!lockFileName) {
    logger.warn('No vendir.lock.yml found');
    return null;
  }
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.warn('Empty vendir.lock.yml found');
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating Vendir artifacts');
    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {},
      toolConstraints: [
        { toolName: 'vendir', constraint: config.constraints?.vendir },
        { toolName: 'helm', constraint: config.constraints?.helm },
      ],
    };

    await exec(`vendir sync`, execOptions);

    logger.debug('Returning updated Vendir artifacts');

    const fileChanges: UpdateArtifactsResult[] = [];

    const newVendirLockContent = await readLocalFile(lockFileName, 'utf8');
    const isLockFileChanged = existingLockFileContent !== newVendirLockContent;
    if (isLockFileChanged) {
      fileChanges.push({
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newVendirLockContent,
        },
      });
    }

    // add modified vendir archives to artifacts
    logger.debug("Adding Sync'd files to git");
    // Files must be in the vendor path to get added
    const vendorDir = getParentDir(packageFileName);
    const status = await getRepoStatus();
    if (status) {
      const modifiedFiles = status.modified ?? [];
      const notAddedFiles = status.not_added;
      const deletedFiles = status.deleted ?? [];

      for (const f of modifiedFiles.concat(notAddedFiles)) {
        const isFileInVendorDir = f.startsWith(vendorDir);
        if (vendorDir || isFileInVendorDir) {
          fileChanges.push({
            file: {
              type: 'addition',
              path: f,
              contents: await readLocalFile(f),
            },
          });
        }
      }

      for (const f of deletedFiles) {
        fileChanges.push({
          file: {
            type: 'deletion',
            path: f,
          },
        });
      }
    } else {
      logger.error('Failed to get git status');
    }

    return fileChanges.length ? fileChanges : null;
  } catch (err) {
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
