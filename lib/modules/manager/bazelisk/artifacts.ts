import { logger } from '../../../logger/index.ts';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { updateBazelLockfile } from '../bazel-module/lockfile.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`bazelisk.updateArtifacts(${packageFileName})`);

  if (!updatedDeps.length && !config.isLockFileMaintenance) {
    logger.debug('No updated bazelisk deps - returning null');
    return null;
  }

  const moduleFileName = getSiblingFileName(packageFileName, 'MODULE.bazel');
  const existingModuleContent = await readLocalFile(moduleFileName, 'utf8');
  if (!existingModuleContent) {
    logger.debug('No MODULE.bazel found - skipping artifact update');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'MODULE.bazel.lock');
  const existingLockContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockContent) {
    logger.debug('No MODULE.bazel.lock found - skipping artifact update');
    return null;
  }

  await writeLocalFile(packageFileName, newPackageFileContent);

  return await updateBazelLockfile(
    lockFileName,
    moduleFileName,
    config.isLockFileMaintenance,
  );
}
