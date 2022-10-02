import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { AzurePipelinesTasksDatasource } from '../../datasource/azure-pipelines-tasks';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';
import type { AzurePipelines, Container, Repository } from './types';

const AzurePipelinesTaskRegex = regEx(/^(?<name>[^@]+)@(?<version>.*)$/);

export function extractRepository(
  repository: Repository
): PackageDependency | null {
  if (repository.type !== 'github') {
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
    packageName: `https://github.com/${repository.name}.git`,
    replaceString: repository.ref,
  };
}

export function extractContainer(
  container: Container
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
    'Azure pipelines docker image'
  );
  dep.depType = 'docker';

  return dep;
}

export function extractAzurePipelinesTasks(
  task: string
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
  filename: string
): AzurePipelines | null {
  let pkg: AzurePipelines | null = null;
  try {
    pkg = load(content, { json: true }) as AzurePipelines;
  } catch (err) /* istanbul ignore next */ {
    logger.info({ filename, err }, 'Error parsing azure-pipelines content');
    return null;
  }

  return pkg;
}

export function extractPackageFile(
  content: string,
  filename: string
): PackageFile | null {
  logger.trace(`azurePipelines.extractPackageFile(${filename})`);
  const deps: PackageDependency[] = [];

  const pkg = parseAzurePipelines(content, filename);
  if (!pkg) {
    return null;
  }

  for (const repository of pkg.resources?.repositories ?? []) {
    const dep = extractRepository(repository);
    if (dep) {
      deps.push(dep);
    }
  }

  for (const container of pkg.resources?.containers ?? []) {
    const dep = extractContainer(container);
    if (dep) {
      deps.push(dep);
    }
  }

  for (const { jobs } of pkg.stages ?? []) {
    for (const { steps } of jobs ?? []) {
      for (const step of steps ?? []) {
        const task = extractAzurePipelinesTasks(step.task);
        if (task) {
          deps.push(task);
        }
      }
    }
  }

  for (const { steps } of pkg.jobs ?? []) {
    for (const step of steps ?? []) {
      const task = extractAzurePipelinesTasks(step.task);
      if (task) {
        deps.push(task);
      }
    }
  }

  for (const step of pkg.steps ?? []) {
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
