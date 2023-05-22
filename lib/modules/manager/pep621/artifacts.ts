import is from '@sindresorhus/is';
import { writeLocalFile } from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { processors } from './processors';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, newPackageFileContent } = updateArtifact;

  await writeLocalFile(packageFileName, newPackageFileContent);

  // process specific tool sets
  const result: UpdateArtifactsResult[] = [];
  for (const processor of processors) {
    const artifactUpdates = await processor.updateArtifacts(updateArtifact);
    if (is.array(artifactUpdates)) {
      result.push(...artifactUpdates);
    }
  }

  return result.length > 0 ? result : null;
}
