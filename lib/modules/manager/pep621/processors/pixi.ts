import { isNonEmptyArray } from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { exec } from '../../../../util/exec/index.ts';
import type { ExecOptions } from '../../../../util/exec/types.ts';
import {
  deleteLocalFile,
  ensureCacheDir,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../../util/fs/index.ts';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../types.ts';
import type { PyProject } from '../schema.ts';
import { BasePyProjectProcessor } from './abstract.ts';

export const commandLock = 'pixi lock --no-progress --color=never --quiet';

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
    const { isLockFileMaintenance } = config;

    if (!isNonEmptyArray(updatedDeps) && !isLockFileMaintenance) {
      logger.debug('No updated pixi deps - returning null');
      return null;
    }

    const lockFileName = getSiblingFileName(packageFileName, 'pixi.lock');
    const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (!existingLockFileContent) {
      logger.debug('No pixi.lock found');
      return null;
    }

    // `pixi lock` can execute arbitrary code from conda package hooks, so it is
    // gated behind `allowedUnsafeExecutions`.
    // https://pixi.prefix.dev/latest/security/#4-treat-package-hooks-as-code-execution
    if (!GlobalConfig.get('allowedUnsafeExecutions').includes('pixi')) {
      logger.once.warn(
        '`pixi lock` was requested to run, but `pixi` is not permitted in the allowedUnsafeExecutions',
      );
      return null;
    }

    const constraint =
      config.constraints?.pixi ?? project.tool?.pixi?.['requires-pixi'];

    try {
      if (isLockFileMaintenance) {
        await deleteLocalFile(lockFileName);
      }

      // https://pixi.sh/latest/features/environment/#caching-packages
      const PIXI_CACHE_DIR = await ensureCacheDir('pixi');
      const extraEnv = {
        PIXI_CACHE_DIR,
        RATTLER_CACHE_DIR: PIXI_CACHE_DIR,
      };

      const execOptions: ExecOptions = {
        cwdFile: packageFileName,
        extraEnv,
        docker: {},
        toolConstraints: [{ toolName: 'pixi', constraint }],
      };
      await exec([commandLock], execOptions);

      const newPixiLockContent = await readLocalFile(lockFileName, 'utf8');
      if (existingLockFileContent === newPixiLockContent) {
        logger.debug(`${lockFileName} is unchanged`);
        return null;
      }
      return [
        {
          file: {
            type: 'addition',
            path: lockFileName,
            contents: newPixiLockContent,
          },
        },
      ];
    } catch (err) {
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.debug({ err }, `Failed to update ${lockFileName} file`);
      return [
        {
          artifactError: {
            fileName: lockFileName,
            stderr: `${err}`,
          },
        },
      ];
    }
  }
}
