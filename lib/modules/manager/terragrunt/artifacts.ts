import { logger } from '../../../logger/index.ts';
import { updateArtifacts as updateTerraformArtifacts } from '../terraform/lockfile/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

export async function updateArtifacts(
  artifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  if (!artifact.config.isLockFileMaintenance) {
    logger.debug(
      `UpdateType ${
        artifact.config.updateType as string
      } is not supported for terragrunt`,
    );
    return null;
  }

  return await updateTerraformArtifacts(artifact);
}
