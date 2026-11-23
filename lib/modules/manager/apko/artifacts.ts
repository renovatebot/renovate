import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

export function updateArtifacts(
  _updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  return Promise.reject(new Error('not implemented'));
}
