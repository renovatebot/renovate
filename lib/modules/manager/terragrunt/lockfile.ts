import { updateArtifacts as updateTerraformArtifacts } from '../terraform/lockfile/index';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts(
  artifact: UpdateArtifact
): Promise<UpdateArtifactsResult[] | null> {
  if (artifact.config.updateType !== 'lockFileMaintenance') {
    return null;
  }

  return await updateTerraformArtifacts(artifact);
}
