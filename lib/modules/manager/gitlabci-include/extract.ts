import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import type {
  GitlabInclude,
  GitlabIncludeProject,
  GitlabPipeline,
} from '../gitlabci/types';
import { replaceReferenceTags } from '../gitlabci/utils';
import type { PackageDependency, PackageFile } from '../types';
import {
  filterIncludeFromGitlabPipeline,
  isGitlabIncludeProject,
  isNonEmptyObject,
} from './common';

function extractDepFromIncludeFile(
  includeObj: GitlabIncludeProject
): PackageDependency {
  const dep: PackageDependency = {
    datasource: GitlabTagsDatasource.id,
    depName: includeObj.project,
    depType: 'repository',
  };
  if (!includeObj.ref) {
    dep.skipReason = 'unknown-version';
    return dep;
  }
  dep.currentValue = includeObj.ref;
  return dep;
}

function getIncludeProjectsFromInclude(
  includeValue: GitlabInclude[] | GitlabInclude
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

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];
  const { platform, endpoint } = GlobalConfig.get();
  try {
    const doc = load(replaceReferenceTags(content), {
      json: true,
    }) as GitlabPipeline;
    const includes = getAllIncludeProjects(doc);
    for (const includeObj of includes) {
      const dep = extractDepFromIncludeFile(includeObj);
      if (platform === 'gitlab' && endpoint) {
        dep.registryUrls = [endpoint.replace(regEx(/\/api\/v4\/?/), '')];
      }
      deps.push(dep);
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.stack?.startsWith('YAMLException:')) {
      logger.debug({ err }, 'YAML exception extracting GitLab CI includes');
    } else {
      logger.warn({ err }, 'Error extracting GitLab CI includes');
    }
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
