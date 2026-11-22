import { logger } from '../../../../logger/index.ts';
import { updatePixiLockfile } from '../../pixi/lockfile.ts';
import { findPixiLockFile } from '../../pixi/workspace.ts';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../types.ts';
import { resolveToolConstraint } from '../../util.ts';
import type { PyProject } from '../schema.ts';
import { BasePyProjectProcessor } from './abstract.ts';

export class PixiProcessor extends BasePyProjectProcessor {
  process(_project: PyProject, deps: PackageDependency[]): PackageDependency[] {
    return deps;
  }

  extractLockedVersions(
    _project: PyProject,
    deps: PackageDependency[],
    _packageFile: string,
  ): Promise<PackageDependency[]> {
    return Promise.resolve(deps);
  }

  override async getLockfiles(
    _project: PyProject,
    packageFile: string,
  ): Promise<string[]> {
    const lockFile = await findPixiLockFile(packageFile);
    if (lockFile) {
      return [lockFile.lockFileName];
    }
    logger.debug({ packageFile }, 'No pixi.lock found');
    return [];
  }

  async updateArtifacts(
    { config, updatedDeps, packageFileName }: UpdateArtifact,
    project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null> {
    const lockFile = await findPixiLockFile(packageFileName);
    if (!lockFile) {
      logger.debug({ packageFileName }, 'No pixi.lock found');
      return null;
    }

    // The `pixi` manager maintains the lock file of the parent workspace.
    if (lockFile.isParent && config.isLockFileMaintenance) {
      logger.debug(
        { packageFileName },
        'Skipping lock file maintenance of parent pixi workspace',
      );
      return null;
    }

    const constraint = await resolveToolConstraint(config, 'pixi', () =>
      lockFile.isParent
        ? lockFile.requiresPixi
        : project.tool?.pixi?.['requires-pixi'],
    );

    // The `pep621` manager has already written the updated package file, so
    // `newPackageFileContent` is intentionally left unset here.
    return await updatePixiLockfile({
      packageFileName,
      lockFileName: lockFile.lockFileName,
      updatedDeps,
      isLockFileMaintenance: config.isLockFileMaintenance,
      constraint,
    });
  }
}
