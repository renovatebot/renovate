import type {
  ExtractConfig,
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../types.ts';
import type { PyProject } from '../schema.ts';

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

  /**
   * Attaches locked versions from the processor's lockfile to the given dependencies.
   * @param project PyProject object
   * @param deps List of already extracted/processed dependencies
   * @param packageFile Path of the package file the dependencies were extracted from
   * @param config Extract config, e.g. to check whether a feature is enabled
   */
  extractLockedVersions(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
    config?: ExtractConfig,
  ): Promise<PackageDependency[]>;

  getLockfiles(project: PyProject, packageFile: string): Promise<string[]>;
}
