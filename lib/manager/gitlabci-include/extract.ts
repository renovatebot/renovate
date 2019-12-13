import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import { logger } from '../../logger';
import { PackageDependency, ExtractConfig, PackageFile } from '../common';

function extractDepFromInclude(includeObj: {
  file: any;
  project: string;
  ref: string;
}): PackageDependency | null {
  if (!includeObj.file || !includeObj.project) {
    return null;
  }
  const dep: PackageDependency = {
    datasource: 'gitlab',
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

export function extractPackageFile(
  content: string,
  _packageFile: string,
  config: ExtractConfig
): PackageFile | null {
  const deps: PackageDependency[] = [];
  try {
    const doc = yaml.safeLoad(content, { json: true });
    if (doc.include && is.array(doc.include)) {
      for (const includeObj of doc.include) {
        const dep = extractDepFromInclude(includeObj);
        if (dep) {
          if (config.endpoint) {
            dep.registryUrls = [config.endpoint.replace(/\/api\/v4\/?/, '')];
          }
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.stack && err.stack.startsWith('YAMLException:')) {
      logger.debug({ err });
      logger.info('YAML exception extracting GitLab CI includes');
    } else {
      logger.warn({ err }, 'Error extracting GitLab CI includes');
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
