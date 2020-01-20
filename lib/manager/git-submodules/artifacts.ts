import { UpdateArtifact, UpdateArtifactsResult } from '../common';

export default function updateArtifacts({
  updatedDeps,
}: UpdateArtifact): UpdateArtifactsResult[] | null {
  return [
    {
      file: {
        name: updatedDeps[0],
        contents: '',
      },
    },
  ];
}
