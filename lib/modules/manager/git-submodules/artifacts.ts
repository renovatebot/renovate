import { logger } from '../../../logger';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export default function updateArtifacts({
  updatedDeps,
}: UpdateArtifact): UpdateArtifactsResult[] | null {
  const res: UpdateArtifactsResult[] = [];
  updatedDeps.forEach((dep) => {
    // TODO: types (#7154)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    logger.info(`Updating submodule ${dep.depName}`);
    res.push({
      file: { type: 'addition', path: dep.depName!, contents: '' },
    });
  });
  return res;
}
