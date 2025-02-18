import is from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type {
  ExecOptions,
  ExtraEnv,
  ToolConstraint,
} from '../../../util/exec/types';
import {
  deleteLocalFile,
  getSiblingFileName,
  localPathExists,
  privateCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact, UpdateArtifactsResult, Upgrade } from '../types';
import { parseKustomize } from './extract';

function generateHelmEnvs(): ExtraEnv {
  return {
    HELM_EXPERIMENTAL_OCI: '1',
    // set cache and config files to a path in privateCacheDir to prevent file and credential leakage
    HELM_REGISTRY_CONFIG: `${upath.join(privateCacheDir(), 'registry.json')}`,
    HELM_REPOSITORY_CONFIG: `${upath.join(
      privateCacheDir(),
      'repositories.yaml',
    )}`,
    HELM_REPOSITORY_CACHE: `${upath.join(privateCacheDir(), 'repositories')}`,
  };
}

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

async function inflateHelmChart(
  execOptions: ExecOptions,
  chartHome: string,
  dependency: Upgrade,
  flagEnabled: boolean,
): Promise<void> {
  const currentChartExistingPath = await localExistingChartPath(
    chartHome,
    dependency.depName,
    dependency.currentVersion,
  );

  if (!flagEnabled && is.nullOrUndefined(currentChartExistingPath)) {
    logger.debug(
      `Not inflating Helm chart for ${dependency.depName} as kustomizeInflateHelmCharts is not enabled and the current version isn't inflated`,
    );
    return;
  }

  if (
    is.nonEmptyString(currentChartExistingPath) &&
    is.nonEmptyString(dependency.newVersion)
  ) {
    logger.debug(`Deleting previous helm chart: ${currentChartExistingPath}`);
    await deleteLocalFile(currentChartExistingPath);
  }

  const versionToPull = dependency.newVersion ?? dependency.currentVersion;
  const versionToPullExistingPath = await localExistingChartPath(
    chartHome,
    dependency.depName,
    versionToPull,
  );

  if (is.nonEmptyString(versionToPullExistingPath)) {
    logger.debug(
      `Helm chart ${dependency.depName} version ${versionToPull} already exists at ${versionToPullExistingPath}`,
    );
    return;
  }

  const folderName = `${dependency.depName}-${versionToPull}`;
  const untarDir = upath.join(chartHome, folderName);
  const registryUrl = dependency.registryUrls[0];
  logger.debug(
    `Pulling helm chart ${dependency.depName} version ${versionToPull} to ${untarDir}`,
  );
  const cmd =
    `helm pull --untar --untardir ${quote(untarDir)} ` +
    `--version ${quote(versionToPull)} --repo ${quote(registryUrl)} ${dependency.depName}`;

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
    project.helmGlobals.chartHome,
  );

  try {
    const helmToolConstraint: ToolConstraint = {
      toolName: 'helm',
      constraint: config.constraints?.helm,
    };

    const execOptions: ExecOptions = {
      docker: {},
      userConfiguredEnv: config.env,
      extraEnv: generateHelmEnvs(),
      toolConstraints: [helmToolConstraint],
    };

    for (const dependency of updatedDeps) {
      if (!is.nonEmptyString(dependency.depName)) {
        continue;
      }

      if (dependency.depType !== 'HelmChart') {
        continue;
      }

      if (!is.nonEmptyArray(dependency.registryUrls)) {
        continue;
      }

      if (dependency.newVersion === dependency.currentVersion) {
        continue;
      }

      await inflateHelmChart(
        execOptions,
        chartHome,
        dependency,
        isUpdateOptionInflateChartArchives,
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
    // istanbul ignore if
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
