import is from '@sindresorhus/is';
import { writeLocalFile } from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { processors } from './processors';
import { parsePyProject } from './utils';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, newPackageFileContent } = updateArtifact;

  await writeLocalFile(packageFileName, newPackageFileContent);

  const project = parsePyProject(packageFileName, newPackageFileContent);
  if (is.nullOrUndefined(project)) {
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
    if (is.array(artifactUpdates)) {
      result.push(...artifactUpdates);
    }
  }

  return result.length > 0 ? result : null;
}
