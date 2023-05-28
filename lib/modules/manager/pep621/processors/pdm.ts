import is from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { exec } from '../../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../../util/exec/types';
import { getSiblingFileName, readLocalFile } from '../../../../util/fs';
import { PypiDatasource } from '../../../datasource/pypi';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../types';
import type { PyProject } from '../schema';
import { parseDependencyGroupRecord } from '../utils';
import type { PyProjectProcessor } from './types';

export class PdmProcessor implements PyProjectProcessor {
  process(project: PyProject, deps: PackageDependency[]): PackageDependency[] {
    const pdm = project.tool?.pdm;
    if (is.nullOrUndefined(pdm)) {
      return deps;
    }

    deps.push(
      ...parseDependencyGroupRecord(
        'tool.pdm.dev-dependencies',
        pdm['dev-dependencies']
      )
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

  async updateArtifacts(
    updateArtifact: UpdateArtifact,
    project: PyProject
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
        toolConstraints: [pythonConstraint, pdmConstraint],
      };

      // on lockFileMaintenance do not specify any packages and update the complete lock file
      // else only update specific packages
      let packageList = '';
      if (!isLockFileMaintenance) {
        packageList = ' ';
        packageList += updatedDeps.map((value) => value.packageName).join(' ');
      }
      const cmd = `pdm update${packageList}`;
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
