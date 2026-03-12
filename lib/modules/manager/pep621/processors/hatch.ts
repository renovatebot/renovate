import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../types.ts';
import type { PyProject } from '../schema.ts';
import { BasePyProjectProcessor } from './abstract.ts';

export class HatchProcessor extends BasePyProjectProcessor {
  process(
    pyproject: PyProject,
    deps: PackageDependency[],
  ): PackageDependency[] {
    const hatchDeps = pyproject.tool?.hatch?.deps;
    if (hatchDeps) {
      deps.push(...hatchDeps);
    }
    return deps;
  }

  extractLockedVersions(
    _project: PyProject,
    deps: PackageDependency[],
    _packageFile: string,
  ): Promise<PackageDependency[]> {
    return Promise.resolve(deps);
  }

  updateArtifacts(
    _updateArtifact: UpdateArtifact,
    _project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null> {
    // Hatch does not have lock files at the moment
    // https://github.com/pypa/hatch/issues/749
    return Promise.resolve(null);
  }
}
