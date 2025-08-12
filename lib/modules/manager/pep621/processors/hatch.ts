import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../types';
import type { PyProject } from '../schema';
import type { PyProjectProcessor } from './types';

export class HatchProcessor implements PyProjectProcessor {
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
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
  ): Promise<PackageDependency[]> {
    return Promise.resolve(deps);
  }

  updateArtifacts(
    updateArtifact: UpdateArtifact,
    project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null> {
    // Hatch does not have lock files at the moment
    // https://github.com/pypa/hatch/issues/749
    return Promise.resolve(null);
  }
}
