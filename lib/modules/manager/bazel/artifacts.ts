import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { updateCode } from './common';
import type { BazelManagerData } from './types';

export function updateArtifacts(
  updateArtifact: UpdateArtifact<BazelManagerData>
): UpdateArtifactsResult[] | null {
  const { packageFileName: path, updatedDeps: upgrades } = updateArtifact;
  let { newPackageFileContent: contents } = updateArtifact;
  for (const upgrade of upgrades) {
    const { depType, newDigest, managerData } = upgrade;
    const { idx } = managerData!;

    if (depType === 'container_pull' && newDigest) {
      contents = updateCode(contents, [idx, 'digest'], newDigest);
    }
  }

  return [
    {
      file: {
        type: 'addition',
        path,
        contents,
      },
    },
  ];
}
