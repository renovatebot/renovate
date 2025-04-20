import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { parseSingleYaml } from '../../../util/yaml';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
import { isOCIRegistry, removeOCIPrefix } from '../helmv3/oci';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { HelmsmanDocument } from './types';

const chartRegex = regEx('^(?<registryRef>[^/]*)/(?<packageName>[^/]*)$');

function createDep(
  key: string,
  doc: HelmsmanDocument,
): PackageDependency | null {
  const dep: PackageDependency = {
    depName: key,
    datasource: HelmDatasource.id,
  };
  const anApp = doc.apps[key];
  if (!anApp) {
    return null;
  }

  if (!anApp.version) {
    dep.skipReason = 'unspecified-version';
    return dep;
  }
  dep.currentValue = anApp.version;

  // in case of OCI repository, we need a PackageDependency with a DockerDatasource and a packageName
  if (isOCIRegistry(anApp.chart)) {
    dep.datasource = DockerDatasource.id;
    dep.packageName = removeOCIPrefix(anApp.chart!);
    return dep;
  }

  const regexResult = anApp.chart ? chartRegex.exec(anApp.chart) : null;
  if (!regexResult?.groups) {
    dep.skipReason = 'invalid-url';
    return dep;
  }

  if (!is.nonEmptyString(regexResult.groups.packageName)) {
    dep.skipReason = 'invalid-name';
    return dep;
  }
  dep.packageName = regexResult.groups.packageName;

  const registryUrl = doc.helmRepos[regexResult.groups.registryRef];
  if (!is.nonEmptyString(registryUrl)) {
    dep.skipReason = 'no-repository';
    return dep;
  }
  dep.registryUrls = [registryUrl];

  return dep;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): PackageFileContent | null {
  try {
    // TODO: use schema (#9610)
    const doc = parseSingleYaml<HelmsmanDocument>(content);
    if (!doc.apps) {
      logger.debug({ packageFile }, `Missing apps keys`);
      return null;
    }

    const deps = Object.keys(doc.apps)
      .map((key) => createDep(key, doc))
      .filter(is.truthy); // filter null values

    if (deps.length === 0) {
      return null;
    }

    return { deps };
  } catch (err) /* istanbul ignore next */ {
    if (err.stack?.startsWith('YAMLException:')) {
      logger.debug({ err, packageFile }, 'YAML exception extracting');
    } else {
      logger.debug({ err, packageFile }, 'Error extracting');
    }
    return null;
  }
}
