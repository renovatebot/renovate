import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { trimLeadingSlash } from '../../../util/url';
import { parseYaml } from '../../../util/yaml';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';
import {
  filterIncludeFromGitlabPipeline,
  isGitlabIncludeComponent,
  isGitlabIncludeLocal,
  isNonEmptyObject,
} from './common';
import type {
  GitlabInclude,
  GitlabIncludeComponent,
  GitlabPipeline,
  Image,
  Job,
  Services,
} from './types';
import { getGitlabDep } from './utils';

// See https://docs.gitlab.com/ee/ci/components/index.html#use-a-component
const componentReferenceRegex = regEx(
  /(?<fqdn>[^/]+)\/(?<projectPath>.+)\/(?:.+)@(?<specificVersion>.+)/,
);
const componentReferenceLatestVersion = '~latest';

export function extractFromImage(
  image: Image | undefined,
  registryAliases?: Record<string, string>,
): PackageDependency | null {
  if (is.undefined(image)) {
    return null;
  }
  let dep: PackageDependency | null = null;
  if (is.string(image)) {
    dep = getGitlabDep(image, registryAliases);
    dep.depType = 'image';
  } else if (is.string(image?.name)) {
    dep = getGitlabDep(image.name, registryAliases);
    dep.depType = 'image-name';
  }
  return dep;
}

export function extractFromServices(
  services: Services | undefined,
  registryAliases?: Record<string, string>,
): PackageDependency[] {
  if (is.undefined(services)) {
    return [];
  }
  const deps: PackageDependency[] = [];
  for (const service of services) {
    if (is.string(service)) {
      const dep = getGitlabDep(service, registryAliases);
      dep.depType = 'service-image';
      deps.push(dep);
    } else if (is.string(service?.name)) {
      const dep = getGitlabDep(service.name, registryAliases);
      dep.depType = 'service-image';
      deps.push(dep);
    }
  }
  return deps;
}

export function extractFromJob(
  job: Job | undefined,
  registryAliases?: Record<string, string>,
): PackageDependency[] {
  if (is.undefined(job)) {
    return [];
  }
  const deps: PackageDependency[] = [];
  if (is.object(job)) {
    const { image, services } = { ...job };
    if (is.object(image) || is.string(image)) {
      const dep = extractFromImage(image, registryAliases);
      if (dep) {
        deps.push(dep);
      }
    }
    if (is.array(services)) {
      deps.push(...extractFromServices(services, registryAliases));
    }
  }
  return deps;
}

function getIncludeComponentsFromInclude(
  includeValue: GitlabInclude[] | GitlabInclude,
): GitlabIncludeComponent[] {
  const includes = is.array(includeValue) ? includeValue : [includeValue];
  return includes.filter(isGitlabIncludeComponent);
}

function getAllIncludeComponents(
  data: GitlabPipeline,
): GitlabIncludeComponent[] {
  const childrenData = Object.values(filterIncludeFromGitlabPipeline(data))
    .filter(isNonEmptyObject)
    .map(getAllIncludeComponents)
    .flat();

  // Process include key.
  if (data.include) {
    childrenData.push(...getIncludeComponentsFromInclude(data.include));
  }
  return childrenData;
}

function extractDepFromIncludeComponent(
  includeComponent: GitlabIncludeComponent,
  registryAliases?: Record<string, string>,
): PackageDependency | null {
  let componentUrl = includeComponent.component;
  if (registryAliases) {
    for (const key in registryAliases) {
      componentUrl = componentUrl.replace(key, registryAliases[key]);
    }
  }
  const componentReference = componentReferenceRegex.exec(componentUrl)?.groups;
  if (!componentReference) {
    logger.debug(
      { componentReference: componentUrl },
      'Ignoring malformed component reference',
    );
    return null;
  }
  const projectPathParts = componentReference.projectPath.split('/');
  if (projectPathParts.length < 2) {
    logger.debug(
      { componentReference: componentUrl },
      'Ignoring component reference with incomplete project path',
    );
    return null;
  }

  const dep: PackageDependency = {
    datasource: GitlabTagsDatasource.id,
    depName: componentReference.projectPath,
    depType: 'repository',
    currentValue: componentReference.specificVersion,
    registryUrls: [`https://${componentReference.fqdn}`],
  };
  if (dep.currentValue === componentReferenceLatestVersion) {
    logger.debug(
      { componentVersion: dep.currentValue },
      'Ignoring component version',
    );
    dep.skipReason = 'unsupported-version';
  }
  return dep;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  let deps: PackageDependency[] = [];
  try {
    // TODO: use schema (#9610)
    const docs = parseYaml<GitlabPipeline>(content, {
      uniqueKeys: false,
    });
    for (const doc of docs) {
      if (is.object(doc)) {
        for (const [property, value] of Object.entries(doc)) {
          switch (property) {
            case 'image':
              {
                const dep = extractFromImage(
                  value as Image,
                  config.registryAliases,
                );
                if (dep) {
                  deps.push(dep);
                }
              }
              break;

            case 'services':
              deps.push(
                ...extractFromServices(
                  value as Services,
                  config.registryAliases,
                ),
              );
              break;

            default:
              deps.push(
                ...extractFromJob(value as Job, config.registryAliases),
              );
              break;
          }
        }
        deps = deps.filter(is.truthy);
      }

      const includedComponents = getAllIncludeComponents(doc);
      for (const includedComponent of includedComponents) {
        const dep = extractDepFromIncludeComponent(
          includedComponent,
          config.registryAliases,
        );
        if (dep) {
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.stack?.startsWith('YAMLException:')) {
      logger.debug(
        { err, packageFile },
        'YAML exception extracting GitLab CI includes',
      );
    } else {
      logger.debug(
        { err, packageFile },
        'Error extracting GitLab CI dependencies',
      );
    }
  }

  return deps.length ? { deps } : null;
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const filesToExamine = [...packageFiles];
  const seen = new Set<string>(packageFiles);
  const results: PackageFile[] = [];

  // extract all includes from the files
  while (filesToExamine.length > 0) {
    const file = filesToExamine.pop()!;

    const content = await readLocalFile(file, 'utf8');
    if (!content) {
      logger.debug(
        { packageFile: file },
        `Empty or non existent gitlabci file`,
      );
      continue;
    }
    let docs: GitlabPipeline[];
    try {
      // TODO: use schema (#9610)
      docs = parseYaml(content, {
        uniqueKeys: false,
      });
    } catch (err) {
      logger.debug(
        { err, packageFile: file },
        'Error extracting GitLab CI dependencies',
      );
      continue;
    }

    for (const doc of docs) {
      if (is.array(doc?.include)) {
        for (const includeObj of doc.include.filter(isGitlabIncludeLocal)) {
          const fileObj = trimLeadingSlash(includeObj.local);
          if (!seen.has(fileObj)) {
            seen.add(fileObj);
            filesToExamine.push(fileObj);
          }
        }
      } else if (is.string(doc?.include)) {
        const fileObj = trimLeadingSlash(doc.include);
        if (!seen.has(fileObj)) {
          seen.add(fileObj);
          filesToExamine.push(fileObj);
        }
      }
    }

    const result = extractPackageFile(content, file, config);
    if (result !== null) {
      results.push({
        packageFile: file,
        deps: result.deps,
      });
    }
  }

  logger.trace(
    { packageFiles, files: filesToExamine.entries() },
    'extracted all GitLab CI files',
  );

  if (!results.length) {
    return null;
  }

  return results;
}
