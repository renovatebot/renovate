import { logger } from '../../../logger';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export default function updateArtifacts({
  updatedDeps,
}: UpdateArtifact): UpdateArtifactsResult[] | null {
  const res: UpdateArtifactsResult[] = [];
  updatedDeps.forEach((dep) => {
    // TODO: types (#22198)
    logger.info({ name: dep.depName }, 'Updating git-submodule');
    res.push({
      file: { type: 'addition', path: dep.depName!, contents: '' },
    });
  });
  return res;
}
