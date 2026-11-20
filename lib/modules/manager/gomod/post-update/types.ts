import type { FileChange } from '../../../../util/git/types.ts';
import type { ArtifactError } from '../../types.ts';

export interface GoModTidyExecutionResult {
  updatedArtifacts: FileChange[];
  artifactErrors: ArtifactError[];
}
