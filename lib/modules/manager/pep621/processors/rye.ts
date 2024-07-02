import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { exec } from '../../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../../util/exec/types';
import { getSiblingFileName, readLocalFile } from '../../../../util/fs';
import { extractPackageFile as extractRequirementsFile } from '../../pip_requirements/extract';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../../types';
import type { PyProject } from '../schema';
import { depTypes, parseDependencyGroupRecord } from '../utils';
import type { PyProjectProcessor } from './types';

const ryeUpdateCMD = 'rye lock --update ';
const ryeUpdateAllCMD = 'rye lock --update-all --all-features';

const lockFileName = 'requirements.lock';
const devLockFileName = 'requirements-dev.lock';

export class RyeProcessor implements PyProjectProcessor {
  process(project: PyProject, deps: PackageDependency[]): PackageDependency[] {
    const rye = project.tool?.rye;
    if (is.nullOrUndefined(rye)) {
      return deps;
    }

    deps.push(
      ...parseDependencyGroupRecord(
        depTypes.ryeDevDependencies,
        rye['dev-dependencies'],
      ),
    );

    const ryeSources = rye.sources;
    if (is.nullOrUndefined(ryeSources)) {
      return deps;
    }

    const registryUrls: string[] = [];
    for (const source of ryeSources) {
      registryUrls.push(source.url);
    }
    for (const dep of deps) {
      dep.registryUrls = registryUrls;
    }

    return deps;
  }

  async extractLockedVersions(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
  ): Promise<PackageDependency[]> {
    if (is.nullOrUndefined(project.tool?.rye)) {
      return Promise.resolve(deps);
    }

    deps = await extractLockedVersions(
      packageFile,
      lockFileName,
      depTypes.dependencies,
      deps,
    );
    deps = await extractLockedVersions(
      packageFile,
      devLockFileName,
      depTypes.ryeDevDependencies,
      deps,
    );

    return Promise.resolve(deps);
  }

  async updateArtifacts(
    updateArtifact: UpdateArtifact,
    project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null> {
    const { config, updatedDeps, packageFileName } = updateArtifact;

    const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

    // abort if no lockfile is defined
    const lockFile = getSiblingFileName(packageFileName, lockFileName);

    const devLockFile = getSiblingFileName(packageFileName, devLockFileName);

    try {
      const existingLockFileContent = await readLocalFile(lockFile, 'utf8');
      if (is.nullOrUndefined(existingLockFileContent)) {
        logger.debug(`No ${lockFileName} found`);
        return null;
      }
      const existingDevLockFileContent = await readLocalFile(
        devLockFile,
        'utf8',
      );
      if (is.nullOrUndefined(existingDevLockFileContent)) {
        logger.debug(`No ${devLockFileName} found`);
        return null;
      }

      const pythonConstraint: ToolConstraint = {
        toolName: 'python',
        constraint:
          config.constraints?.python ?? project.project?.['requires-python'],
      };
      const ryeConstraint: ToolConstraint = {
        toolName: 'rye',
        constraint: config.constraints?.rye,
      };

      const execOptions: ExecOptions = {
        cwdFile: packageFileName,
        docker: {},
        userConfiguredEnv: config.env,
        toolConstraints: [pythonConstraint, ryeConstraint],
      };

      // on lockFileMaintenance do not specify any packages and update the complete lock file
      // else only update specific packages
      const cmds: string[] = [];
      if (isLockFileMaintenance) {
        cmds.push(ryeUpdateAllCMD);
      } else {
        cmds.push(...generateCMDs(updatedDeps));
      }
      await exec(cmds, execOptions);

      // check for changes
      const fileChanges: UpdateArtifactsResult[] = [];
      const newLockContent = await readLocalFile(lockFile, 'utf8');
      const isLockFileChanged = existingLockFileContent !== newLockContent;

      if (isLockFileChanged) {
        fileChanges.push({
          file: {
            type: 'addition',
            path: lockFile,
            contents: newLockContent,
          },
        });
      } else {
        logger.debug(`${lockFileName} is unchanged`);
      }

      const newDevLockContent = await readLocalFile(devLockFile, 'utf8');
      const isDevLockFileChanged =
        existingDevLockFileContent !== newDevLockContent;

      if (isDevLockFileChanged) {
        fileChanges.push({
          file: {
            type: 'addition',
            path: devLockFile,
            contents: newDevLockContent,
          },
        });
      } else {
        logger.debug(`${devLockFileName} is unchanged`);
      }

      return fileChanges.length ? fileChanges : null;
    } catch (err) {
      // istanbul ignore if
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.debug({ err }, 'Failed to update Rye lock file');
      return [
        {
          artifactError: {
            lockFile: lockFile,
            stderr: err.message,
          },
        },
        {
          artifactError: {
            lockFile: devLockFile,
            stderr: err.message,
          },
        },
      ];
    }
  }
}

async function extractLockedVersions(
  packageFile: string,
  lockFileName: string,
  depType: string | undefined,
  deps: PackageDependency[],
): Promise<PackageDependency[]> {
  const lockFile = getSiblingFileName(packageFile, lockFileName);

  const lockFileContent = await readLocalFile(lockFile, 'utf8');
  if (lockFileContent) {
    const lockFileMapping = extractRequirementsFile(lockFileContent);
    if (is.nullOrUndefined(lockFileMapping)) {
      logger.debug(`Unable to parse ${lockFileName}`);
      return Promise.resolve(deps);
    }

    const lockFileDeps = Object.fromEntries(
      lockFileMapping!.deps.map((dep) => [dep.depName, dep.lockedVersion]),
    );

    for (const dep of deps) {
      const packageName = dep.packageName;
      if (
        packageName &&
        dep.depType == depType &&
        packageName in lockFileDeps
      ) {
        dep.lockedVersion = lockFileDeps[packageName];
      }
    }
  }
  return deps;
}

function generateCMDs(updatedDeps: Upgrade[]): string[] {
  const cmds: string[] = [];
  const packagesByCMD: Record<string, string[]> = {};
  for (const dep of updatedDeps) {
    switch (dep.depType) {
      case depTypes.optionalDependencies: {
        const [group, name] = dep.depName!.split('/');
        addPackageToCMDRecord(
          packagesByCMD,
          `${ryeUpdateCMD} --features ${quote(group)}`,
          name,
        );
        break;
      }
      case depTypes.ryeDevDependencies: {
        const [group, name] = dep.depName!.split('/');
        addPackageToCMDRecord(
          packagesByCMD,
          `${ryeUpdateCMD} --features ${quote(group)}`,
          name,
        );
        break;
      }
      case depTypes.buildSystemRequires:
        // build requirements are not locked in the lock files, no need to update.
        break;
      default: {
        addPackageToCMDRecord(packagesByCMD, ryeUpdateCMD, dep.packageName!);
      }
    }
  }

  for (const commandPrefix in packagesByCMD) {
    for (const pkg in packagesByCMD[commandPrefix].map(quote)) {
      const cmd = `${commandPrefix} ${pkg}`;
      cmds.push(cmd);
    }
  }

  return cmds;
}

function addPackageToCMDRecord(
  packagesByCMD: Record<string, string[]>,
  commandPrefix: string,
  packageName: string,
): void {
  if (is.nullOrUndefined(packagesByCMD[commandPrefix])) {
    packagesByCMD[commandPrefix] = [];
  }
  packagesByCMD[commandPrefix].push(packageName);
}
