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
import { PdmLockfileSchema, type PyProject } from '../schema';
import { depTypes, parseDependencyGroupRecord } from '../utils';
import type { PyProjectProcessor } from './types';

const pdmUpdateCMD = 'pdm update --no-sync';

export class PdmProcessor implements PyProjectProcessor {
  process(project: PyProject, deps: PackageDependency[]): PackageDependency[] {
    const pdm = project.tool?.pdm;
    if (is.nullOrUndefined(pdm)) {
      return deps;
    }

    deps.push(
      ...parseDependencyGroupRecord(
        depTypes.pdmDevDependencies,
        pdm['dev-dependencies'],
      ),
    );

    const pdmSource = pdm.source;
    if (is.nullOrUndefined(pdmSource)) {
      return deps;
    }

    // add pypi default url, if there is no source declared with the name `pypi`. https://daobook.github.io/pdm/pyproject/tool-pdm/#specify-other-sources-for-finding-packages
    const containsPyPiUrl = pdmSource.some((value) => value.name === 'pypi');
    const registryUrls: string[] = [];
    if (!containsPyPiUrl) {
      registryUrls.push(PypiDatasource.defaultURL);
    }
    for (const source of pdmSource) {
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
    if (
      is.nullOrUndefined(project.tool?.pdm) &&
      project['build-system']?.['build-backend'] !== 'pdm.backend'
    ) {
      return Promise.resolve(deps);
    }

    const lockFileName = getSiblingFileName(packageFile, 'pdm.lock');
    const lockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (lockFileContent) {
      const lockFileMapping = Result.parse(
        lockFileContent,
        PdmLockfileSchema.transform(({ lock }) => lock),
      ).unwrapOrElse({});

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

    const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

    // abort if no lockfile is defined
    const lockFileName = getSiblingFileName(packageFileName, 'pdm.lock');
    try {
      const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
      if (is.nullOrUndefined(existingLockFileContent)) {
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

      const execOptions: ExecOptions = {
        cwdFile: packageFileName,
        docker: {},
        userConfiguredEnv: config.env,
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
      // istanbul ignore if
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

function generateCMDs(updatedDeps: Upgrade[]): string[] {
  const cmds: string[] = [];
  const packagesByCMD: Record<string, string[]> = {};
  for (const dep of updatedDeps) {
    switch (dep.depType) {
      case depTypes.optionalDependencies: {
        const [group, name] = dep.depName!.split('/');
        addPackageToCMDRecord(
          packagesByCMD,
          `${pdmUpdateCMD} -G ${quote(group)}`,
          name,
        );
        break;
      }
      case depTypes.pdmDevDependencies: {
        const [group, name] = dep.depName!.split('/');
        addPackageToCMDRecord(
          packagesByCMD,
          `${pdmUpdateCMD} -dG ${quote(group)}`,
          name,
        );
        break;
      }
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
  if (is.nullOrUndefined(packagesByCMD[commandPrefix])) {
    packagesByCMD[commandPrefix] = [];
  }
  packagesByCMD[commandPrefix].push(packageName);
}
