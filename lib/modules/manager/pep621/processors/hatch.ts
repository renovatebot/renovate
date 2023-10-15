import is from '@sindresorhus/is';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../types';
import type { PyProject } from '../schema';
import type { PyProjectProcessor } from './types';
import { parseDependencyList } from '../utils';

function depTypeFromEnv(envName: string): string {
  return `tool.hatch.envs.${envName}`;
}

export class HatchProcessor implements PyProjectProcessor {
  process(
    pyproject: PyProject,
    deps: PackageDependency[]
  ): PackageDependency[] {
    const hatch_envs = pyproject.tool?.hatch?.envs;
    if (is.nullOrUndefined(hatch_envs)) return deps;

    for (const [envName, env] of Object.entries(hatch_envs)) {
      const depType = depTypeFromEnv(envName);
      const envDeps = parseDependencyList(depType, env?.dependencies);
      deps.push(...envDeps);
      const extraDeps = parseDependencyList(
        depType,
        env?.['extra-dependencies']
      );
      deps.push(...extraDeps);
    }

    return deps;
  }

  async updateArtifacts(
    updateArtifact: UpdateArtifact<Record<string, unknown>>,
    project: PyProject
  ): Promise<UpdateArtifactsResult[] | null> {
    // Hatch does not have lock files at the moment
    // https://github.com/pypa/hatch/issues/749
    return null;
  }
}
