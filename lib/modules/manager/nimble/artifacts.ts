import { isEmptyArray } from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import {
  artifactErrorResult,
  resolveToolConstraint,
  updateLockFile,
} from '../util.ts';

const NIMBLE_LOCK = 'nimble.lock';
const ATLAS_LOCK = 'atlas.lock';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`nimble.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (isEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated nimble deps - returning null');
    return null;
  }

  const nimbleLockFileName = getSiblingFileName(packageFileName, NIMBLE_LOCK);
  const atlasLockFileName = getSiblingFileName(packageFileName, ATLAS_LOCK);

  const [oldNimbleLockContent, oldAtlasLockContent] = await Promise.all([
    readLocalFile(nimbleLockFileName, 'utf8'),
    readLocalFile(atlasLockFileName, 'utf8'),
  ]);

  if (!oldNimbleLockContent && !oldAtlasLockContent) {
    logger.debug(
      `No ${nimbleLockFileName} or ${atlasLockFileName} found - returning null`,
    );
    return null;
  }

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    docker: {},
    toolConstraints: [
      {
        toolName: 'mise',
        constraint: await resolveToolConstraint(config, 'mise'),
      },
    ],
  };

  const results: UpdateArtifactsResult[] = [];

  if (oldNimbleLockContent) {
    try {
      const updated = await updateLockFile({
        lockFileName: nimbleLockFileName,
        existingLockFileContent: oldNimbleLockContent,
        packageFile: {
          path: packageFileName,
          contents: newPackageFileContent,
        },
        deleteLockFile: Boolean(isLockFileMaintenance),
        run: () =>
          exec('mise exec --yes nim@latest -- nimble lock -y', execOptions),
      });
      if (updated) {
        results.push(...updated);
      }
    } catch (err) {
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.warn(
        { lockfile: nimbleLockFileName, err },
        'Failed to update nimble.lock',
      );
      results.push(...artifactErrorResult(nimbleLockFileName, err));
    }
  }

  if (oldAtlasLockContent) {
    try {
      const updated = await updateLockFile({
        lockFileName: atlasLockFileName,
        existingLockFileContent: oldAtlasLockContent,
        packageFile: {
          path: packageFileName,
          contents: newPackageFileContent,
        },
        deleteLockFile: Boolean(isLockFileMaintenance),
        run: () =>
          exec(
            [
              'mise exec --yes nim@latest -- atlas install',
              'mise exec --yes nim@latest -- atlas pin',
            ],
            execOptions,
          ),
      });
      if (updated) {
        results.push(...updated);
      }
    } catch (err) {
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.warn(
        { lockfile: atlasLockFileName, err },
        'Failed to update atlas.lock',
      );
      results.push(...artifactErrorResult(atlasLockFileName, err));
    }
  }

  return results.length > 0 ? results : null;
}
