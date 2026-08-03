import { logger } from '../../../logger/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { getUserPixiConfig } from './extract.ts';
import { updatePixiLockfile } from './lockfile.ts';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pixi.updateArtifacts(${packageFileName})`);

  const pixiConfig = getUserPixiConfig(newPackageFileContent, packageFileName);
  const constraint =
    config.constraints?.pixi ?? pixiConfig?.project['requires-pixi'];

  return await updatePixiLockfile({
    packageFileName,
    updatedDeps,
    isLockFileMaintenance: config.isLockFileMaintenance,
    constraint,
    newPackageFileContent,
  });
}
