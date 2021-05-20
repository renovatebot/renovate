import { logger } from '../../logger';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export default function updateArtifacts({
  updatedDeps,
}: UpdateArtifact): UpdateArtifactsResult[] | null {
  const res: UpdateArtifactsResult[] = [];
  updatedDeps.forEach((dep) => {
    logger.info('Updating submodule ' + dep);
    res.push({
      file: {
        name: dep,
        contents: '',
      },
    });
  });
  return res;
}
