import is from '@sindresorhus/is';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../types';
import type { PyProject } from '../schema';
import { parseDependencyList } from '../utils';
import type { PyProjectProcessor } from './types';

export class HatchProcessor implements PyProjectProcessor {
  process(
    pyproject: PyProject,
    deps: PackageDependency[],
  ): PackageDependency[] {
    const hatch_envs = pyproject.tool?.hatch?.envs;
    if (is.nullOrUndefined(hatch_envs)) {
      return deps;
    }

    for (const [envName, env] of Object.entries(hatch_envs)) {
      const depType = `tool.hatch.envs.${envName}`;
      const envDeps = parseDependencyList(depType, env?.dependencies);
      deps.push(...envDeps);
      const extraDeps = parseDependencyList(
        depType,
        env?.['extra-dependencies'],
      );
      deps.push(...extraDeps);
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
