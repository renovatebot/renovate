import is from '@sindresorhus/is';

const yaml = require('js-yaml');

const { logger } = require('../../logger');

export { extractPackageFile };

function extractDepFromInclude(includeObj) {
  if (!includeObj.file || !includeObj.project) {
    return null;
  }
  const dep = {
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

function extractPackageFile(content, packageFile, config) {
  const deps = [];
  try {
    const doc = yaml.safeLoad(content);
    if (doc.include && is.array(doc.include)) {
      for (const includeObj of doc.include) {
        const dep = extractDepFromInclude(includeObj);
        if (dep) {
          if (config.endpoint) {
            dep.registryUrls = [config.endpoint.replace('/api/v4/', '')];
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
