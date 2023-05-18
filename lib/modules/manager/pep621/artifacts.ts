import is from '@sindresorhus/is';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { processors } from './processors';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact
): Promise<UpdateArtifactsResult[] | null> {
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
