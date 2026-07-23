import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, localPathExists } from '../../../util/fs/index.ts';
import { runBundlerLock } from '../bundler/lock.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName } = updateArtifact;
  const lockFileName = getSiblingFileName(packageFileName, 'Gemfile.lock');
  if (!(await localPathExists(lockFileName))) {
    logger.debug(
      `gemspec: no sibling ${lockFileName} for ${packageFileName} - skipping lock refresh`,
    );
    return null;
  }
  return runBundlerLock(updateArtifact, lockFileName);
}
