import yaml from 'js-yaml';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types';
import {
  getParentDir,
  getSiblingFileName,
  privateCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import * as hostRules from '../../../util/host-rules';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import type { ChartDefinition, Repository, RepositoryRule } from './types';
import {
  aliasRecordToRepositories,
  getRepositories,
  isOCIRegistry,
} from './utils';

async function helmCommands(
  execOptions: ExecOptions,
  manifestPath: string,
  repositories: Repository[]
): Promise<void> {
  const cmd: string[] = [];
  // set cache and config files to a path in privateCacheDir to prevent file and credential leakage
  const helmConfigParameters = [
    `--registry-config ${upath.join(privateCacheDir(), 'registry.json')}`,
    `--repository-config ${upath.join(privateCacheDir(), 'repositories.yaml')}`,
    `--repository-cache ${upath.join(privateCacheDir(), 'repositories')}`,
  ];

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
  registries.forEach((value) => {
    const { username, password } = value.hostRule;
    const parameters = [...helmConfigParameters];
    if (username && password) {
      parameters.push(`--username ${quote(username)}`);
      parameters.push(`--password ${quote(password)}`);

      cmd.push(
        `helm registry login ${parameters.join(' ')} ${value.repository}`
      );
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
    const parameters = [...helmConfigParameters];
    const isPrivateRepo = username && password;
    if (isPrivateRepo) {
      parameters.push(`--username ${quote(username)}`);
      parameters.push(`--password ${quote(password)}`);
    }

    cmd.push(
      `helm repo add ${value.name} ${parameters.join(' ')} ${value.repository}`
    );
  });

  cmd.push(
    `helm dependency update ${helmConfigParameters.join(' ')} ${quote(
      getParentDir(manifestPath)
    )}`
  );

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

  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated helmv3 deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'Chart.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No Chart.lock found');
    return null;
  }
  try {
    // get repositories and registries defined in the package file
    const packages = yaml.load(newPackageFileContent) as ChartDefinition; //TODO #9610
    const locks = yaml.load(existingLockFileContent) as ChartDefinition; //TODO #9610

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
    logger.debug('Updating ' + lockFileName);
    const helmToolConstraint: ToolConstraint = {
      toolName: 'helm',
      constraint: config.constraints?.helm,
    };

    const execOptions: ExecOptions = {
      docker: {
        image: 'sidecar',
      },
      extraEnv: {
        HELM_EXPERIMENTAL_OCI: '1',
      },
      toolConstraints: [helmToolConstraint],
    };
    await helmCommands(execOptions, packageFileName, repositories);
    logger.debug('Returning updated Chart.lock');
    const newHelmLockContent = await readLocalFile(lockFileName, 'utf8');
    if (existingLockFileContent === newHelmLockContent) {
      logger.debug('Chart.lock is unchanged');
      return null;
    }
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newHelmLockContent,
        },
      },
    ];
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
