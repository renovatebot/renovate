import { safeLoad } from 'js-yaml';
import * as datasourceGitTags from '../../datasource/git-tags';
import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

interface Container {
  image: string;
}

interface Repository {
  type: 'git' | 'github' | 'bitbucket';
  name: string;
  ref: string;
}

interface Resources {
  repositories: Repository[];
  containers: Container[];
}

interface AzurePipelines {
  resources: Resources;
}

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
    datasource: datasourceGitTags.id,
    depName: repository.name,
    depType: 'gitTags',
    lookupName: `https://github.com/${repository.name}.git`,
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

export function parseAzurePipelines(
  content: string,
  filename: string
): AzurePipelines | null {
  let pkg = null;
  try {
    pkg = safeLoad(content, { json: true });
  } catch (err) /* istanbul ignore next */ {
    logger.info({ filename, err }, 'Error parsing azure-pipelines content');
    return null;
  }

  if (!pkg || !pkg.resources) {
    return null;
  }

  pkg.resources.containers = pkg.resources.containers || [];
  pkg.resources.repositories = pkg.resources.repositories || [];

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

  // grab the repositories tags
  for (const repository of pkg.resources.repositories) {
    const dep = extractRepository(repository);
    if (dep) {
      deps.push(dep);
    }
  }

  // grab the containers tags
  for (const container of pkg.resources.containers) {
    const dep = extractContainer(container);
    if (dep) {
      deps.push(dep);
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
