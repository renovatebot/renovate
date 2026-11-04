import { logger } from '../../../../logger/index.ts';
import {
  getSiblingFileName,
  localPathExists,
} from '../../../../util/fs/index.ts';
import { updatePixiLockfile } from '../../pixi/lockfile.ts';
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
    const lockfileName = getSiblingFileName(packageFile, 'pixi.lock');
    if (await localPathExists(lockfileName)) {
      return [lockfileName];
    }
    logger.debug({ packageFile }, 'No pixi.lock found');
    return [];
  }

  async updateArtifacts(
    { config, updatedDeps, packageFileName }: UpdateArtifact,
    project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null> {
    const constraint = await resolveToolConstraint(
      config,
      'pixi',
      () => project.tool?.pixi?.['requires-pixi'],
    );

    // The `pep621` manager has already written the updated package file, so
    // `newPackageFileContent` is intentionally left unset here.
    return await updatePixiLockfile({
      packageFileName,
      updatedDeps,
      isLockFileMaintenance: config.isLockFileMaintenance,
      constraint,
    });
  }
}
