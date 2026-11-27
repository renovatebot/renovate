import { runBundlerLock } from '../bundler/lock.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { findGemspecLockFile } from './lockfile.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, newPackageFileContent } = updateArtifact;
  const lockFile = await findGemspecLockFile(
    packageFileName,
    newPackageFileContent,
  );
  if (!lockFile) {
    return null;
  }

  return runBundlerLock(updateArtifact, lockFile.lockFile);
}
