import { logger } from '../../../logger';
import { updateArtifacts as updateTerraformArtifacts } from '../terraform/lockfile/index';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts(
  artifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  if (artifact.config.updateType !== 'lockFileMaintenance') {
    logger.debug(
      `UpdateType ${
        artifact.config.updateType as string
      } is not supported for terragrunt`,
    );
    return null;
  }

  return await updateTerraformArtifacts(artifact);
}
