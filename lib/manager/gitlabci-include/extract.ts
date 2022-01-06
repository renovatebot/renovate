import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import * as datasourceGitlabTags from '../../datasource/gitlab-tags';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { regEx } from '../../util/regex';
import { replaceReferenceTags } from '../gitlabci/utils';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

function extractDepFromIncludeFile(includeObj: {
  file: any;
  project: string;
  ref: string;
}): PackageDependency {
  const dep: PackageDependency = {
    datasource: datasourceGitlabTags.id,
    depName: includeObj.project,
    depType: 'repository',
  };
  if (!includeObj.ref) {
    dep.skipReason = SkipReason.UnknownVersion;
    return dep;
  }
  dep.currentValue = includeObj.ref;
  return dep;
}

export function extractPackageFile(
  content: string,
  _packageFile: string,
  config: ExtractConfig
): PackageFile | null {
  const deps: PackageDependency[] = [];
  try {
    // TODO: fix me (#9610)
    const doc: any = load(replaceReferenceTags(content), {
      json: true,
    });
    let includes;
    if (doc?.include && is.array(doc.include)) {
      includes = doc.include;
    } else {
      includes = [doc.include];
    }
    for (const includeObj of includes) {
      if (includeObj?.file && includeObj.project) {
        const dep = extractDepFromIncludeFile(includeObj);
        if (config.endpoint) {
          dep.registryUrls = [
            config.endpoint.replace(regEx(/\/api\/v4\/?/), ''),
          ];
        }
        deps.push(dep);
      }
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
