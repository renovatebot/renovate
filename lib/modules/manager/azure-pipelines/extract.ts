import { load } from 'js-yaml';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import { AzurePipelinesTasksDatasource } from '../../datasource/azure-pipelines-tasks';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFileContent } from '../types';
import type { AzurePipelines, Container, Repository } from './types';

const AzurePipelinesTaskRegex = regEx(/^(?<name>[^@]+)@(?<version>.*)$/);

export function extractRepository(
  repository: Repository,
): PackageDependency | null {
  let repositoryUrl = null;

  if (repository.type === 'github') {
    repositoryUrl = `https://github.com/${repository.name}.git`;
  } else if (repository.type === 'git') {
    // "git" type indicates an AzureDevOps repository.
    // The repository URL is only deducible if we are running on AzureDevOps (so can use the endpoint)
    // and the name is of the form `Project/Repository`.
    // The name could just be the repository name, in which case AzureDevOps defaults to the
    // same project, which is not currently accessible here. It could be deduced later by exposing
    // the repository URL to managers.
    // https://docs.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/resources-repositories-repository?view=azure-pipelines#types
    const platform = GlobalConfig.get('platform');
    const endpoint = GlobalConfig.get('endpoint');
    if (platform === 'azure' && endpoint) {
      if (repository.name.includes('/')) {
        const [projectName, repoName] = repository.name.split('/');
        repositoryUrl = joinUrlParts(
          endpoint,
          encodeURIComponent(projectName),
          '_git',
          encodeURIComponent(repoName),
        );
      } else {
        logger.debug(
          'Renovate cannot update repositories that do not include the project name',
        );
      }
    }
  }

  if (repositoryUrl === null) {
    return null;
  }

  if (!repository.ref?.startsWith('refs/tags/')) {
    return null;
  }

  return {
    autoReplaceStringTemplate: 'refs/tags/{{newValue}}',
    currentValue: repository.ref.replace('refs/tags/', ''),
    datasource: GitTagsDatasource.id,
    depName: repository.name,
    depType: 'gitTags',
    packageName: repositoryUrl,
    replaceString: repository.ref,
  };
}

export function extractContainer(
  container: Container,
): PackageDependency | null {
  if (!container.image) {
    return null;
  }

  const dep = getDep(container.image);
  logger.debug(
    {
      depName: dep.depName,
      currentValue: dep.currentValue,
      currentDigest: dep.currentDigest,
    },
    'Azure pipelines docker image',
  );
  dep.depType = 'docker';

  return dep;
}

export function extractAzurePipelinesTasks(
  task: string,
): PackageDependency | null {
  const match = AzurePipelinesTaskRegex.exec(task);
  if (match?.groups) {
    return {
      depName: match.groups.name,
      currentValue: match.groups.version,
      datasource: AzurePipelinesTasksDatasource.id,
    };
  }
  return null;
}

export function parseAzurePipelines(
  content: string,
  packageFile: string,
): AzurePipelines | null {
  let pkg: AzurePipelines | null = null;
  try {
    pkg = load(content, { json: true }) as AzurePipelines;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ packageFile, err }, 'Error parsing azure-pipelines content');
    return null;
  }

  return pkg;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`azurePipelines.extractPackageFile(${packageFile})`);
  const deps: PackageDependency[] = [];

  const pkg = parseAzurePipelines(content, packageFile);
  if (!pkg) {
    return null;
  }

  for (const repository of coerceArray(pkg.resources?.repositories)) {
    const dep = extractRepository(repository);
    if (dep) {
      deps.push(dep);
    }
  }

  for (const container of coerceArray(pkg.resources?.containers)) {
    const dep = extractContainer(container);
    if (dep) {
      deps.push(dep);
    }
  }

  for (const { jobs } of coerceArray(pkg.stages)) {
    for (const { steps } of coerceArray(jobs)) {
      for (const step of coerceArray(steps)) {
        const task = extractAzurePipelinesTasks(step.task);
        if (task) {
          deps.push(task);
        }
      }
    }
  }

  for (const { steps } of coerceArray(pkg.jobs)) {
    for (const step of coerceArray(steps)) {
      const task = extractAzurePipelinesTasks(step.task);
      if (task) {
        deps.push(task);
      }
    }
  }

  for (const step of coerceArray(pkg.steps)) {
    const task = extractAzurePipelinesTasks(step.task);
    if (task) {
      deps.push(task);
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
