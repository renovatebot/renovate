import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { exec } from '../../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../../util/exec/types';
import { getSiblingFileName, readLocalFile } from '../../../../util/fs';
import { Result } from '../../../../util/result';
import { PypiDatasource } from '../../../datasource/pypi';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../../types';
import { type PyProject, type Uv, UvLockfileSchema } from '../schema';
import { depTypes, parseDependencyList } from '../utils';
import type { PyProjectProcessor } from './types';

const uvUpdateCMD = 'uv lock';

export class UvProcessor implements PyProjectProcessor {
  process(project: PyProject, deps: PackageDependency[]): PackageDependency[] {
    const uv = project.tool?.uv;
    if (is.nullOrUndefined(uv)) {
      return deps;
    }

    deps.push(
      ...parseDependencyList(
        depTypes.uvDevDependencies,
        uv['dev-dependencies'],
      ),
    );

    const registryUrls = extractRegistryUrls(uv);
    if (registryUrls.length) {
      for (const dep of deps) {
        dep.registryUrls = [...registryUrls];
      }
    }

    return deps;
  }

  async extractLockedVersions(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
  ): Promise<PackageDependency[]> {
    const lockFileName = getSiblingFileName(packageFile, 'uv.lock');
    const lockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (lockFileContent) {
      const { val: lockFileMapping, err } = Result.parse(
        lockFileContent,
        UvLockfileSchema,
      ).unwrap();

      if (err) {
        logger.debug({ packageFile, err }, `Error parsing uv lock file`);
      } else {
        for (const dep of deps) {
          const packageName = dep.packageName;
          if (packageName && packageName in lockFileMapping) {
            dep.lockedVersion = lockFileMapping[packageName];
          }
        }
      }
    }

    return Promise.resolve(deps);
  }

  async updateArtifacts(
    updateArtifact: UpdateArtifact,
    project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null> {
    const { config, updatedDeps, packageFileName } = updateArtifact;

    const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

    // abort if no lockfile is defined
    const lockFileName = getSiblingFileName(packageFileName, 'uv.lock');
    try {
      const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
      if (is.nullOrUndefined(existingLockFileContent)) {
        logger.debug('No uv.lock found');
        return null;
      }

      const pythonConstraint: ToolConstraint = {
        toolName: 'python',
        constraint:
          config.constraints?.python ?? project.project?.['requires-python'],
      };
      const uvConstraint: ToolConstraint = {
        toolName: 'uv',
        constraint: config.constraints?.uv,
      };

      const execOptions: ExecOptions = {
        cwdFile: packageFileName,
        docker: {},
        userConfiguredEnv: config.env,
        toolConstraints: [pythonConstraint, uvConstraint],
      };

      // on lockFileMaintenance do not specify any packages and update the complete lock file
      // else only update specific packages
      let cmd: string;
      if (isLockFileMaintenance) {
        cmd = `${uvUpdateCMD} --upgrade`;
      } else {
        cmd = generateCMD(updatedDeps);
      }
      await exec(cmd, execOptions);

      // check for changes
      const fileChanges: UpdateArtifactsResult[] = [];
      const newLockContent = await readLocalFile(lockFileName, 'utf8');
      const isLockFileChanged = existingLockFileContent !== newLockContent;
      if (isLockFileChanged) {
        fileChanges.push({
          file: {
            type: 'addition',
            path: lockFileName,
            contents: newLockContent,
          },
        });
      } else {
        logger.debug('uv.lock is unchanged');
      }

      return fileChanges.length ? fileChanges : null;
    } catch (err) {
      // istanbul ignore if
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.debug({ err }, 'Failed to update uv lock file');
      return [
        {
          artifactError: {
            lockFile: lockFileName,
            stderr: err.message,
          },
        },
      ];
    }
  }
}

function extractRegistryUrls(uvManifest: Uv): string[] {
  // Extra indexes have priority over default index: https://docs.astral.sh/uv/reference/settings/#extra-index-url
  const registryUrls = uvManifest['extra-index-url'] ?? [];

  if (uvManifest['index-url']) {
    registryUrls.push(uvManifest['index-url']);
  } else if (registryUrls.length) {
    // If default index URL is not overridden, we need to use default PyPI URL additionally to potential extra indexes.
    registryUrls.push(PypiDatasource.defaultURL);
  }

  return registryUrls;
}

function generateCMD(updatedDeps: Upgrade[]): string {
  const deps: string[] = [];

  for (const dep of updatedDeps) {
    switch (dep.depType) {
      case depTypes.optionalDependencies: {
        deps.push(dep.depName!.split('/')[1]);
        break;
      }
      case depTypes.uvDevDependencies: {
        deps.push(dep.depName!);
        break;
      }
      case depTypes.buildSystemRequires:
        // build requirements are not locked in the lock files, no need to update.
        break;
      default: {
        deps.push(dep.packageName!);
      }
    }
  }

  return `${uvUpdateCMD} ${deps.map((dep) => `--upgrade-package ${quote(dep)}`).join(' ')}`;
}
