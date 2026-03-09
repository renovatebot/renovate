import { isString, isTruthy } from '@sindresorhus/is';
import pMap from 'p-map';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types.ts';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { regEx } from '../../../util/regex.ts';
import * as yaml from '../../../util/yaml.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { generateHelmEnvs, generateLoginCmd } from './common.ts';
import { isOCIRegistry, removeOCIPrefix } from './oci.ts';
import type { ChartDefinition, Repository, RepositoryRule } from './types.ts';
import {
  aliasRecordToRepositories,
  getRepositories,
  isFileInDir,
} from './utils.ts';

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
        repository: removeOCIPrefix(value.repository),
        hostRule: hostRules.find({
          url: value.repository.replace('oci://', 'https://'), //TODO we need to replace this, as oci:// will not be accepted as protocol
          hostType: DockerDatasource.id,
        }),
      };
    });

  // if credentials for the registry have been found, log into it
  await pMap(registries, async (value) => {
    const loginCmd = await generateLoginCmd(value);
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
    const parameters = [`${quote(value.repository)}`, `--force-update`];
    const isPrivateRepo = username && password;
    if (isPrivateRepo) {
      parameters.push(`--username ${quote(username)}`);
      parameters.push(`--password ${quote(password)}`);
    }

    cmd.push(`helm repo add ${quote(value.name)} ${parameters.join(' ')}`);
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

  const { isLockFileMaintenance } = config;
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
    // TODO: use schema (#9610)
    const packages = yaml.parseSingleYaml<ChartDefinition>(
      newPackageFileContent,
    );
    const locks = existingLockFileContent
      ? yaml.parseSingleYaml<ChartDefinition>(existingLockFileContent)
      : { dependencies: [] };

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

    if (isTruthy(existingLockFileContent)) {
      const newHelmLockContent = await readLocalFile(lockFileName, 'utf8');
      const isLockFileChanged =
        !isString(newHelmLockContent) ||
        isHelmLockChanged(existingLockFileContent, newHelmLockContent);
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
    if (isTruthy(isUpdateOptionAddChartArchives)) {
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

function isHelmLockChanged(oldContent: string, newContent: string): boolean {
  const regex = regEx(/^generated: ".+"$/m);
  return newContent.replace(regex, '') !== oldContent.replace(regex, '');
}
