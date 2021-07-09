import { logger } from '../../logger';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export default function updateArtifacts({
  updatedDeps,
}: UpdateArtifact): UpdateArtifactsResult[] | null {
  const res: UpdateArtifactsResult[] = [];
  updatedDeps.forEach((dep) => {
    logger.info('Updating submodule ' + dep.depName);
    res.push({
      file: {
        name: dep.depName,
        contents: '',
      },
    });
  });
  return res;
}
