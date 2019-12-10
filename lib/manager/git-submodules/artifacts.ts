import { UpdateArtifactsConfig, UpdateArtifactsResult } from '../common';

export default function updateArtifacts(
  packageFileName: string,
  updatedDeps: string[],
  newPackageFileContent: string,
  config: UpdateArtifactsConfig
): UpdateArtifactsResult[] | null {
  return [
    {
      file: {
        name: updatedDeps[0],
        contents: '',
      },
    },
  ];
}
