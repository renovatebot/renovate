import is from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types';
import {
  deleteLocalFile,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { generateHelmEnvs } from './common';
import { parseKustomize } from './extract';

async function localExistingChartPath(
  chartHome: string,
  dependencyName: string,
  version?: string,
): Promise<string | null> {
  const folderName = `${dependencyName}-${version}`;
  const path = upath.join(chartHome, folderName);
  const pathExists = await localPathExists(path);

  return pathExists ? path : null;
}

function helmRepositoryArgs(
  repository: string,
  depName: string,
  datasource?: string,
): string {
  switch (datasource) {
    case HelmDatasource.id:
      return `--repo ${quote(repository)} ${depName}`;
    case DockerDatasource.id:
      return quote(`oci://${repository}`);
    /* v8 ignore next 2: should never happen */
    default:
      throw new Error(`Unknown datasource: ${datasource}`);
  }
}

async function inflateHelmChart(
  flagEnabled: boolean,
  execOptions: ExecOptions,
  chartHome: string,
  depName: string,
  repository: string,
  currentVersion: string,
  newVersion?: string,
  datasource?: string,
): Promise<void> {
  const currentChartExistingPath = await localExistingChartPath(
    chartHome,
    depName,
    currentVersion,
  );

  if (!flagEnabled && is.nullOrUndefined(currentChartExistingPath)) {
    logger.debug(
      `Not inflating Helm chart for ${depName} as kustomizeInflateHelmCharts is not enabled and the current version isn't inflated`,
    );
    return;
  }

  if (
    is.nonEmptyString(currentChartExistingPath) &&
    is.nonEmptyString(newVersion)
  ) {
    logger.debug(`Deleting previous helm chart: ${currentChartExistingPath}`);
    await deleteLocalFile(currentChartExistingPath);
  }

  const versionToPull = newVersion ?? currentVersion;
  const versionToPullExistingPath = await localExistingChartPath(
    chartHome,
    depName,
    versionToPull,
  );

  if (is.nonEmptyString(versionToPullExistingPath)) {
    logger.debug(
      `Helm chart ${depName} version ${versionToPull} already exists at ${versionToPullExistingPath}`,
    );
    return;
  }

  const folderName = `${depName}-${versionToPull}`;
  const untarDir = upath.join(chartHome, folderName);
  logger.debug(
    `Pulling helm chart ${depName} version ${versionToPull} to ${untarDir}`,
  );

  const cmd =
    `helm pull --untar --untardir ${quote(untarDir)} ` +
    `--version ${quote(versionToPull)} ${helmRepositoryArgs(repository, depName, datasource)}`;

  await exec(cmd, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`kustomize.updateArtifacts(${packageFileName})`);
  const project = parseKustomize(newPackageFileContent);
  const isUpdateOptionInflateChartArchives =
    config.postUpdateOptions?.includes('kustomizeInflateHelmCharts') === true;
  if (is.nullOrUndefined(project)) {
    return [
      {
        artifactError: {
          stderr: 'Failed to parse new package file content',
        },
      },
    ];
  }

  const chartHome = getSiblingFileName(
    packageFileName,
    project.helmGlobals?.chartHome ?? 'charts',
  );

  try {
    const helmToolConstraint: ToolConstraint = {
      toolName: 'helm',
      constraint: config.constraints?.helm,
    };

    const execOptions: ExecOptions = {
      docker: {},
      extraEnv: generateHelmEnvs(config),
      toolConstraints: [helmToolConstraint],
    };

    for (const dependency of updatedDeps) {
      if (!dependency.currentVersion) {
        continue;
      }

      if (dependency.newVersion === dependency.currentVersion) {
        continue;
      }

      if (!is.nonEmptyString(dependency.depName)) {
        continue;
      }

      if (dependency.depType !== 'HelmChart') {
        continue;
      }

      let repository = null;

      switch (dependency.datasource) {
        case HelmDatasource.id:
          repository = dependency.registryUrls?.[0];
          break;
        case DockerDatasource.id:
          repository = dependency.packageName;
          break;
      }

      if (is.nullOrUndefined(repository)) {
        continue;
      }

      await inflateHelmChart(
        isUpdateOptionInflateChartArchives,
        execOptions,
        chartHome,
        dependency.depName,
        repository,
        dependency.currentVersion,
        dependency.newVersion,
        dependency.datasource,
      );
    }

    const status = await getRepoStatus();
    const chartsAddition = status?.not_added ?? [];
    const chartsDeletion = status?.deleted ?? [];

    const fileChanges: UpdateArtifactsResult[] = [];

    for (const file of chartsAddition) {
      // only add artifacts in the chartHome path
      if (!file.startsWith(chartHome)) {
        continue;
      }
      fileChanges.push({
        file: {
          type: 'addition',
          path: file,
          contents: await readLocalFile(file),
        },
      });
    }

    for (const file of chartsDeletion) {
      // only add artifacts in the chartHome path
      if (!file.startsWith(chartHome)) {
        continue;
      }
      fileChanges.push({
        file: {
          type: 'deletion',
          path: file,
        },
      });
    }

    return fileChanges.length > 0 ? fileChanges : null;
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to inflate helm chart');
    return [
      {
        artifactError: {
          stderr: err.message,
        },
      },
    ];
  }
}
