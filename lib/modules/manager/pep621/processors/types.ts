import type {
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
   * Extracts additional dependencies and/or modifies existing ones based on
   * what this specific pyproject.toml says about its tool subtable. Runs
   * synchronously and consults only `project` — never other files.
   * @param project PyProject object
   * @param deps List of already extracted/processed dependencies
   */
  process(project: PyProject, deps: PackageDependency[]): PackageDependency[];

  /**
   * Revises deps based on dependency information that lives in files OTHER
   * than `project` — e.g. uv workspace-root inheritance. Runs after
   * `process()` and before `extractLockedVersions()`. Async because it may
   * read the filesystem.
   *
   * Processors that have no cross-file concerns can leave the no-op default
   * provided by `BasePyProjectProcessor`.
   */
  extractWorkspaceContext(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
  ): Promise<PackageDependency[]>;

  extractLockedVersions(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
  ): Promise<PackageDependency[]>;

  getLockfiles(project: PyProject, packageFile: string): Promise<string[]>;
}
