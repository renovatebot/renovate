import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { HelmDatasource } from '../../datasource/helm';
import { DockerDatasource } from '../../datasource/docker';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { HelmsmanDocument } from './types';

const chartRegex = regEx('^(?<registryRef>[^/]*)/(?<packageName>[^/]*)$');
const ociChartRegex = regEx('^(?<registryRef>oci:\/\/[^\/]*)\/(?<packageName>([^\/]\/?)*$');

function createDep(
  key: string,
  doc: HelmsmanDocument
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
  const ociRegexResult = anApp.chart ? ociChartRegex.exec(anApp.chart) : null;
  if (ociRegexResult && ociRegexResult.groups) {

    if (!is.nonEmptyString(ociRegexResult.groups.packageName)) {
      dep.skipReason = 'invalid-name';
      return dep;
    }

    if (!is.nonEmptyString(ociRegexResult.groups.registryRef)) {
      dep.skipReason = 'no-repository';
      return dep;
    }

    dep.datasource = DockerDatasource.id
    const ociRegistryUrl = ociRegexResult.groups.registryRef.replace('oci://', '');
    dep.registryUrls = [ociRegistryUrl];
    dep.packageName = ociRegistryUrl + ociRegexResult.groups.packageName;

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
  _config: ExtractConfig
): PackageFileContent | null {
  try {
    // TODO: fix me (#9610)
    const doc = load(content, {
      json: true,
    }) as HelmsmanDocument;
    if (!(doc.apps)) {
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
