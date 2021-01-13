import { logger } from '../../logger';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';

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
