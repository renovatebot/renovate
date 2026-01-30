import { isArray, isNullOrUndefined } from '@sindresorhus/is';
import { writeLocalFile } from '../../../util/fs/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { parsePyProject } from './extract.ts';
import { processors } from './processors/index.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, newPackageFileContent } = updateArtifact;

  await writeLocalFile(packageFileName, newPackageFileContent);

  const project = parsePyProject(newPackageFileContent, packageFileName);
  if (isNullOrUndefined(project)) {
    return [
      {
        artifactError: {
          stderr: 'Failed to parse new package file content',
        },
      },
    ];
  }

  // process specific tool sets
  const result: UpdateArtifactsResult[] = [];
  for (const processor of processors) {
    const artifactUpdates = await processor.updateArtifacts(
      updateArtifact,
      project,
    );
    if (isArray(artifactUpdates)) {
      result.push(...artifactUpdates);
    }
  }

  return result.length > 0 ? result : null;
}
