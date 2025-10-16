import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { exec } from '../../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../../util/exec/types';
import { getSiblingFileName, readLocalFile } from '../../../../util/fs';
import { getGitEnvironmentVariables } from '../../../../util/git/auth';
import { Result } from '../../../../util/result';
import { PypiDatasource } from '../../../datasource/pypi';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../../types';
import { PdmLockfile, type PyProject } from '../schema';
import type { Pep621ManagerData } from '../types';
import { depTypes } from '../utils';
import { BasePyProjectProcessor } from './abstract';

const pdmUpdateCMD = 'pdm update --no-sync --update-eager';

export class PdmProcessor extends BasePyProjectProcessor {
  override lockfileName = 'pdm.lock';

  process(
    project: PyProject,
    deps: PackageDependency[],
  ): PackageDependency<Pep621ManagerData>[] {
    const devDependencies = project.tool?.pdm?.devDependencies;
    if (devDependencies) {
      deps.push(...devDependencies);
    }

    const registryUrls = project.tool?.pdm?.registryUrls;
    if (registryUrls) {
      for (const dep of deps) {
        if (dep.datasource === PypiDatasource.id) {
          dep.registryUrls = registryUrls;
        }
      }
    }

    return deps;
  }

  async extractLockedVersions(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
  ): Promise<PackageDependency[]> {
    if (
      !project.tool?.pdm &&
      project['build-system']?.['build-backend'] !== 'pdm.backend'
    ) {
      return Promise.resolve(deps);
    }

    const lockFileName = getSiblingFileName(packageFile, 'pdm.lock');
    const lockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (lockFileContent) {
      const lockFileMapping = Result.parse(
        lockFileContent,
        PdmLockfile.transform(({ lock }) => lock),
      ).unwrapOr({});

      for (const dep of deps) {
        const packageName = dep.packageName;
        if (packageName && packageName in lockFileMapping) {
          dep.lockedVersion = lockFileMapping[packageName];
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

    const { isLockFileMaintenance } = config;

    // abort if no lockfile is defined
    const lockFileName = getSiblingFileName(packageFileName, this.lockfileName);
    try {
      const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
      if (!existingLockFileContent) {
        logger.debug('No pdm.lock found');
        return null;
      }

      const pythonConstraint: ToolConstraint = {
        toolName: 'python',
        constraint:
          config.constraints?.python ?? project.project?.['requires-python'],
      };
      const pdmConstraint: ToolConstraint = {
        toolName: 'pdm',
        constraint: config.constraints?.pdm,
      };

      const extraEnv = {
        ...getGitEnvironmentVariables(['pep621']),
      };
      const execOptions: ExecOptions = {
        cwdFile: packageFileName,
        extraEnv,
        docker: {},
        toolConstraints: [pythonConstraint, pdmConstraint],
      };

      // on lockFileMaintenance do not specify any packages and update the complete lock file
      // else only update specific packages
      const cmds: string[] = [];
      if (isLockFileMaintenance) {
        cmds.push(pdmUpdateCMD);
      } else {
        cmds.push(...generateCMDs(updatedDeps));
      }
      await exec(cmds, execOptions);

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
        logger.debug('pdm.lock is unchanged');
      }

      return fileChanges.length ? fileChanges : null;
    } catch (err) {
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.debug({ err }, 'Failed to update PDM lock file');
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

function generateCMDs(updatedDeps: Upgrade<Pep621ManagerData>[]): string[] {
  const cmds: string[] = [];
  const packagesByCMD: Record<string, string[]> = {};
  for (const dep of updatedDeps) {
    switch (dep.depType) {
      case depTypes.optionalDependencies: {
        if (!dep.managerData?.depGroup) {
          logger.once.warn(
            { dep: dep.depName },
            'Unexpected optional dependency without group',
          );
          continue;
        }
        addPackageToCMDRecord(
          packagesByCMD,
          `${pdmUpdateCMD} -G ${quote(dep.managerData.depGroup)}`,
          dep.packageName!,
        );
        break;
      }
      case depTypes.dependencyGroups:
      case depTypes.pdmDevDependencies: {
        if (!dep.managerData?.depGroup) {
          logger.once.warn(
            { dep: dep.depName },
            'Unexpected dev dependency without group',
          );
          continue;
        }
        addPackageToCMDRecord(
          packagesByCMD,
          `${pdmUpdateCMD} -dG ${quote(dep.managerData.depGroup)}`,
          dep.packageName!,
        );
        break;
      }
      case depTypes.buildSystemRequires:
        // build requirements are not locked in the lock files, no need to update.
        // Reference: https://github.com/pdm-project/pdm/discussions/2869
        break;
      default: {
        addPackageToCMDRecord(packagesByCMD, pdmUpdateCMD, dep.packageName!);
      }
    }
  }

  for (const commandPrefix in packagesByCMD) {
    const packageList = packagesByCMD[commandPrefix].map(quote).join(' ');
    const cmd = `${commandPrefix} ${packageList}`;
    cmds.push(cmd);
  }

  return cmds;
}

function addPackageToCMDRecord(
  packagesByCMD: Record<string, string[]>,
  commandPrefix: string,
  packageName: string,
): void {
  if (!packagesByCMD[commandPrefix]) {
    packagesByCMD[commandPrefix] = [];
  }
  packagesByCMD[commandPrefix].push(packageName);
}
