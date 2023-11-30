import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import { AzurePipelinesTasksDatasource } from '../../datasource/azure-pipelines-tasks';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFileContent } from '../types';
import {
  AzurePipelines,
  AzurePipelinesYaml,
  Container,
  Deploy,
  Deployment,
  Job,
  Jobs,
  Repository,
  Step,
} from './schema';

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
  const res = AzurePipelinesYaml.safeParse(content);
  if (res.success) {
    return res.data;
  } else {
    logger.debug(
      { err: res.error, packageFile },
      'Error parsing pubspec lockfile.',
    );
  }
  return null;
}

function extractSteps(
  steps?: Step[],
): PackageDependency<Record<string, any>>[] {
  const deps = [];
  for (const step of coerceArray(steps)) {
    const task = extractAzurePipelinesTasks(step.task);
    if (task) {
      deps.push(task);
    }
  }
  return deps;
}

function extractJob(job?: Job): PackageDependency<Record<string, any>>[] {
  return extractSteps(coerceArray(job?.steps));
}

function extractDeploy(
  deploy?: Deploy,
): PackageDependency<Record<string, any>>[] {
  const deps = extractJob(deploy?.deploy);
  deps.push(...extractJob(deploy?.postRouteTraffic));
  deps.push(...extractJob(deploy?.preDeploy));
  deps.push(...extractJob(deploy?.routeTraffic));
  deps.push(...extractJob(deploy?.on?.failure));
  deps.push(...extractJob(deploy?.on?.success));
  return deps;
}

function extractJobs(jobs?: Jobs): PackageDependency<Record<string, any>>[] {
  const deps: PackageDependency<Record<string, any>>[] = [];
  if (!jobs) {
    return deps;
  }

  for (const jobOrDeployment of jobs) {
    const deployment = jobOrDeployment as Deployment;
    if (deployment.strategy) {
      deps.push(...extractDeploy(deployment.strategy.canary));
      deps.push(...extractDeploy(deployment.strategy.rolling));
      deps.push(...extractDeploy(deployment.strategy.runOnce));
    }

    const job = jobOrDeployment as Job;
    deps.push(...extractJob(job));
  }
  return deps;
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
    deps.push(...extractJobs(jobs));
  }

  deps.push(...extractJobs(pkg.jobs));
  deps.push(...extractSteps(pkg.steps));

  if (!deps.length) {
    return null;
  }
  return { deps };
}
