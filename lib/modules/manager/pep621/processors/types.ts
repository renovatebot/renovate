import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../types';
import type { PyProject } from '../schema';

export interface PyProjectProcessor {
  updateArtifacts(
    updateArtifact: UpdateArtifact,
    project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null>;

  /**
   * Extracts additional dependencies and/or modifies existing ones based on the tool configuration.
   * If no relevant section for the processor exists, then it should return the received dependencies unmodified.
   * @param project PyProject object
   * @param deps List of already extracted/processed dependencies
   */
  process(project: PyProject, deps: PackageDependency[]): PackageDependency[];
}
