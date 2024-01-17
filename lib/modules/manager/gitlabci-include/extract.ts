import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import { parseSingleYaml } from '../../../util/yaml';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import type {
  GitlabInclude,
  GitlabIncludeComponent,
  GitlabIncludeProject,
  GitlabPipeline,
} from '../gitlabci/types';
import { replaceReferenceTags } from '../gitlabci/utils';
import type { PackageDependency, PackageFileContent } from '../types';
import {
  filterIncludeFromGitlabPipeline,
  isGitlabIncludeComponent,
  isGitlabIncludeProject,
  isNonEmptyObject,
} from './common';

// See https://docs.gitlab.com/ee/ci/components/index.html#use-a-component
const componentReferenceRegex = regEx(
  /(?<fqdn>[^/]+)\/(?<projectPath>.+)\/(.+)@(?<specificVersion>.+)/,
);
const componentReferenceLatestVersion = '~latest';

function extractDepFromIncludeFile(
  includeObj: GitlabIncludeProject,
): PackageDependency {
  const dep: PackageDependency = {
    datasource: GitlabTagsDatasource.id,
    depName: includeObj.project,
    depType: 'repository',
  };
  if (!includeObj.ref) {
    dep.skipReason = 'unspecified-version';
    return dep;
  }
  dep.currentValue = includeObj.ref;
  return dep;
}

function extractDepFromIncludeComponent(
  includeComponent: GitlabIncludeComponent,
  endpoint: string | undefined,
): PackageDependency | null {
  const componentReference = componentReferenceRegex.exec(
    includeComponent.component,
  )?.groups;
  if (!componentReference) {
    logger.debug(
      { componentReference: includeComponent.component },
      'Ignoring malformed component reference',
    );
    return null;
  }
  const projectPathParts = componentReference.projectPath.split('/');
  if (projectPathParts.length < 2) {
    logger.debug(
      { componentReference: includeComponent.component },
      'Ignoring component reference with incomplete project path',
    );
    return null;
  }

  const dep: PackageDependency = {
    datasource: GitlabTagsDatasource.id,
    depName: componentReference.projectPath,
    depType: 'repository',
    currentValue: componentReference.specificVersion,
  };
  if (dep.currentValue === componentReferenceLatestVersion) {
    logger.debug(
      { componentVersion: dep.currentValue },
      'Ignoring component version',
    );
    dep.skipReason = 'unsupported-version';
  }
  const endpointUrl = parseUrl(endpoint);
  if (endpointUrl && endpointUrl.hostname !== componentReference.fqdn) {
    logger.debug(
      { componentReference: includeComponent.component },
      'Ignoring external component reference',
    );
    dep.skipReason = 'invalid-value';
  }
  return dep;
}

function getIncludeProjectsFromInclude(
  includeValue: GitlabInclude[] | GitlabInclude,
): GitlabIncludeProject[] {
  const includes = is.array(includeValue) ? includeValue : [includeValue];

  // Filter out includes that dont have a file & project.
  return includes.filter(isGitlabIncludeProject);
}

function getAllIncludeProjects(data: GitlabPipeline): GitlabIncludeProject[] {
  // If Array, search each element.
  if (is.array(data)) {
    return (data as GitlabPipeline[])
      .filter(isNonEmptyObject)
      .map(getAllIncludeProjects)
      .flat();
  }

  const childrenData = Object.values(filterIncludeFromGitlabPipeline(data))
    .filter(isNonEmptyObject)
    .map(getAllIncludeProjects)
    .flat();

  // Process include key.
  if (data.include) {
    childrenData.push(...getIncludeProjectsFromInclude(data.include));
  }
  return childrenData;
}

function getIncludeComponentsFromInclude(
  includeValue: GitlabInclude[] | GitlabInclude,
): GitlabIncludeComponent[] {
  const includes = is.array(includeValue) ? includeValue : [includeValue];

  // Filter out includes that dont have a file & project.
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

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  const platform = GlobalConfig.get('platform');
  const endpoint = GlobalConfig.get('endpoint');
  try {
    // TODO: use schema (#9610)
    const doc = parseSingleYaml<GitlabPipeline>(replaceReferenceTags(content), {
      json: true,
    });
    const includes = getAllIncludeProjects(doc);
    for (const includeObj of includes) {
      const dep = extractDepFromIncludeFile(includeObj);
      if (platform === 'gitlab' && endpoint) {
        dep.registryUrls = [endpoint.replace(regEx(/\/api\/v4\/?/), '')];
      }
      deps.push(dep);
    }
    const includedComponents = getAllIncludeComponents(doc);
    for (const includedComponent of includedComponents) {
      const dep = extractDepFromIncludeComponent(includedComponent, endpoint);
      if (dep) {
        deps.push(dep);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.stack?.startsWith('YAMLException:')) {
      logger.debug(
        { err, packageFile },
        'YAML exception extracting GitLab CI includes',
      );
    } else {
      logger.debug({ err, packageFile }, 'Error extracting GitLab CI includes');
    }
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
