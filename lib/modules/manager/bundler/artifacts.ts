import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { getLockFilePath } from './common.ts';
import { runBundlerLock } from './lock.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = await getLockFilePath(updateArtifact.packageFileName);
  return runBundlerLock(updateArtifact, lockFileName);
}
