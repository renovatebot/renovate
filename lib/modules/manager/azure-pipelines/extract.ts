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
import type { AzurePipelinesExtractConfig } from './index';

const AzurePipelinesTaskRegex = regEx(/^(?<name>[^@]+)@(?<version>.*)$/);

export function extractRepository(
  repository: Repository,
  config: AzurePipelinesExtractConfig,
): PackageDependency | null {
  let repositoryUrl = null;

  if (repository.type === 'github') {
    repositoryUrl = `https://github.com/${repository.name}.git`;
  } else if (repository.type === 'git') {
    const platform = GlobalConfig.get('platform');
    const endpoint = GlobalConfig.get('endpoint');
    let projectName = '';
    let repoName = '';

    if (platform === 'azure' && endpoint) {
      // extract the project name if the repository from which the pipline is referencing templates contains the Azure DevOps project name
      if (repository.name.includes('/')) {
        const [_projectName, _repoName] = repository.name.split('/');
        projectName = _projectName;
        repoName = _repoName;

        // if the repository from which the pipline is referencing templates does not contain the Azure DevOps project name, get the project name from the repository containing the pipeline file being process
      } else if (config.repository && config.repository.includes('/')) {
        projectName = config.repository.substring(
          0,
          config.repository.indexOf('/'),
        );
        repoName = repository.name;
      }
      repositoryUrl = buildRepositoryUrl(endpoint, projectName, repoName);
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
  steps: Step[] | undefined,
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

function extractJob(job: Job | undefined): PackageDependency[] {
  return extractSteps(job?.steps);
}

function extractDeploy(deploy: Deploy | undefined): PackageDependency[] {
  const deps = extractJob(deploy?.deploy);
  deps.push(...extractJob(deploy?.postRouteTraffic));
  deps.push(...extractJob(deploy?.preDeploy));
  deps.push(...extractJob(deploy?.routeTraffic));
  deps.push(...extractJob(deploy?.on?.failure));
  deps.push(...extractJob(deploy?.on?.success));
  return deps;
}

function extractJobs(jobs: Jobs | undefined): PackageDependency[] {
  const deps: PackageDependency[] = [];
  for (const jobOrDeployment of coerceArray(jobs)) {
    const deployment = jobOrDeployment as Deployment;
    if (deployment.strategy) {
      deps.push(...extractDeploy(deployment.strategy.canary));
      deps.push(...extractDeploy(deployment.strategy.rolling));
      deps.push(...extractDeploy(deployment.strategy.runOnce));
      continue;
    }

    const job = jobOrDeployment as Job;
    deps.push(...extractJob(job));
  }
  return deps;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: AzurePipelinesExtractConfig,
): PackageFileContent | null {
  logger.trace(`azurePipelines.extractPackageFile(${packageFile})`);
  const deps: PackageDependency[] = [];

  const pkg = parseAzurePipelines(content, packageFile);
  if (!pkg) {
    return null;
  }

  for (const repository of coerceArray(pkg.resources?.repositories)) {
    const dep = extractRepository(repository, config);
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

function buildRepositoryUrl(
  endpoint: string,
  projectName: string,
  repoName: string,
): string | null {
  if ([endpoint, projectName, repoName].some((x) => !x || x === '')) {
    return null;
  }
  return joinUrlParts(
    endpoint,
    encodeURIComponent(projectName),
    '_git',
    encodeURIComponent(repoName),
  );
}
