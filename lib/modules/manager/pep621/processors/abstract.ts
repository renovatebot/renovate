import { logger } from '../../../../logger';
import { findLocalSiblingOrParent } from '../../../../util/fs';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../types';
import type { PyProject } from '../schema';
import type { PyProjectProcessor } from './types';

export abstract class BasePyProjectProcessor implements PyProjectProcessor {
  // The name of the lockfiles to be searched for.
  // This should be defined in the concrete processor classes.
  // No lockfiles will be forwarded outside the manager implementation.
  protected lockfileName: string | undefined;

  abstract updateArtifacts(
    updateArtifact: UpdateArtifact,
    project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null>;

  abstract process(
    project: PyProject,
    deps: PackageDependency[],
  ): PackageDependency[];

  abstract extractLockedVersions(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
  ): Promise<PackageDependency[]>;

  async getLockfiles(
    _project: PyProject,
    packageFile: string,
  ): Promise<string[]> {
    if (!this.lockfileName) {
      logger.trace(
        { packageFile },
        `No lockfile name defined for ${this.constructor.name}`,
      );
      return [];
    }

    const lockfilePath = await findLocalSiblingOrParent(
      packageFile,
      this.lockfileName,
    );
    if (lockfilePath) {
      return [lockfilePath];
    }

    logger.debug({ packageFile }, `No ${this.lockfileName} found`);
    return [];
  }
}
