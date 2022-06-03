import { logger } from '../../../logger';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export default function updateArtifacts({
  updatedDeps,
}: UpdateArtifact): UpdateArtifactsResult[] | null {
  const res: UpdateArtifactsResult[] = [];
  updatedDeps.forEach((dep) => {
    logger.info('Updating submodule ' + dep.depName);
    res.push({
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      file: { type: 'addition', path: dep.depName!, contents: '' },
    });
  });
  return res;
}
