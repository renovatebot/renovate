import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import pMap from 'p-map';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { generateHelmEnvs, generateLoginCmd } from './common';
import type { ChartDefinition, Repository, RepositoryRule } from './types';
import {
  aliasRecordToRepositories,
  getRepositories,
  isFileInDir,
  isOCIRegistry,
} from './utils';

async function helmCommands(
  execOptions: ExecOptions,
  manifestPath: string,
  repositories: Repository[],
): Promise<void> {
  const cmd: string[] = [];
  // get OCI registries and detect host rules
  const registries: RepositoryRule[] = repositories
    .filter(isOCIRegistry)
    .map((value) => {
      return {
        ...value,
        repository: value.repository.replace('oci://', ''),
        hostRule: hostRules.find({
          url: value.repository.replace('oci://', 'https://'), //TODO we need to replace this, as oci:// will not be accepted as protocol
          hostType: DockerDatasource.id,
        }),
      };
    });

  // if credentials for the registry have been found, log into it
  await pMap(registries, async (value) => {
    const loginCmd = await generateLoginCmd(value, 'helm registry login');
    if (loginCmd) {
      cmd.push(loginCmd);
    }
  });

  // find classic Chart repositories and fitting host rules
  const classicRepositories: RepositoryRule[] = repositories
    .filter((repository) => !isOCIRegistry(repository))
    .map((value) => {
      return {
        ...value,
        hostRule: hostRules.find({
          url: value.repository,
          hostType: HelmDatasource.id,
        }),
      };
    });

  // add helm repos if an alias or credentials for the url are defined
  classicRepositories.forEach((value) => {
    const { username, password } = value.hostRule;
    const parameters = [`${value.repository}`];
    const isPrivateRepo = username && password;
    if (isPrivateRepo) {
      parameters.push(`--username ${quote(username)}`);
      parameters.push(`--password ${quote(password)}`);
    }

    cmd.push(`helm repo add ${value.name} ${parameters.join(' ')}`);
  });

  cmd.push(`helm dependency update ${quote(getParentDir(manifestPath))}`);

  await exec(cmd, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`helmv3.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';
  const isUpdateOptionAddChartArchives = config.postUpdateOptions?.includes(
    'helmUpdateSubChartArchives',
  );

  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated helmv3 deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'Chart.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent && !isUpdateOptionAddChartArchives) {
    logger.debug('No Chart.lock found');
    return null;
  }
  try {
    // get repositories and registries defined in the package file
    const packages = yaml.load(newPackageFileContent) as ChartDefinition; //TODO #9610
    const locks = existingLockFileContent
      ? (yaml.load(existingLockFileContent) as ChartDefinition)
      : { dependencies: [] }; //TODO #9610

    const chartDefinitions: ChartDefinition[] = [];
    // prioritize registryAlias naming for Helm repositories
    if (config.registryAliases) {
      chartDefinitions.push({
        dependencies: aliasRecordToRepositories(config.registryAliases),
      });
    }
    chartDefinitions.push(packages, locks);

    const repositories = getRepositories(chartDefinitions);

    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating Helm artifacts');
    const helmToolConstraint: ToolConstraint = {
      toolName: 'helm',
      constraint: config.constraints?.helm,
    };

    const execOptions: ExecOptions = {
      docker: {},
      extraEnv: generateHelmEnvs(),
      toolConstraints: [helmToolConstraint],
    };
    await helmCommands(execOptions, packageFileName, repositories);
    logger.debug('Returning updated Helm artifacts');

    const fileChanges: UpdateArtifactsResult[] = [];

    if (is.truthy(existingLockFileContent)) {
      const newHelmLockContent = await readLocalFile(lockFileName, 'utf8');
      const isLockFileChanged = existingLockFileContent !== newHelmLockContent;
      if (isLockFileChanged) {
        fileChanges.push({
          file: {
            type: 'addition',
            path: lockFileName,
            contents: newHelmLockContent,
          },
        });
      } else {
        logger.debug('Chart.lock is unchanged');
      }
    }

    // add modified helm chart archives to artifacts
    if (is.truthy(isUpdateOptionAddChartArchives)) {
      const chartsPath = getSiblingFileName(packageFileName, 'charts');
      const status = await getRepoStatus();
      const chartsAddition = status.not_added ?? [];
      const chartsDeletion = status.deleted ?? [];

      for (const file of chartsAddition) {
        // only add artifacts in the chart sub path
        if (!isFileInDir(chartsPath, file)) {
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
        // only add artifacts in the chart sub path
        if (!isFileInDir(chartsPath, file)) {
          continue;
        }
        fileChanges.push({
          file: {
            type: 'deletion',
            path: file,
          },
        });
      }
    }

    return fileChanges.length > 0 ? fileChanges : null;
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update Helm lock file');
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
