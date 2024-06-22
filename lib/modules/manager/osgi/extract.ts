import is from '@sindresorhus/is';
import * as json5 from 'json5';
import { coerce, satisfies } from 'semver';
import { logger } from '../../../logger';
import { MavenDatasource } from '../../datasource/maven';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { Bundle, FeatureModel } from './types';

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig,
): PackageFileContent | null {
  // References:
  // - OSGi compendium release 8 ( https://docs.osgi.org/specification/osgi.cmpn/8.0.0/service.feature.html )
  // - The Sling implementation of the feature model ( https://sling.apache.org/documentation/development/feature-model.html )
  logger.trace(`osgi.extractPackageFile($packageFile)`);

  const deps: PackageDependency[] = [];
  let featureModel: FeatureModel;
  try {
    // Compendium R8 159.3: JS comments are supported
    featureModel = json5.parse<FeatureModel>(content);
  } catch (err) {
    logger.warn({ packageFile, err }, 'Failed to parse osgi file');
    return null;
  }

  if (
    // for empty an empty result
    is.nullOrUndefined(featureModel) ||
    // Compendium R8 159.9: resource versioning
    !isSupportedFeatureResourceVersion(featureModel, packageFile)
  ) {
    return null;
  }

  // OSGi Compendium R8 159.4: bundles entry
  const allBundles = featureModel.bundles ?? [];

  // The 'execution-environment' key is supported by the Sling/OSGi feature model implementation
  const execEnvFramework =
    featureModel['execution-environment:JSON|false']?.['framework'];
  if (!is.nullOrUndefined(execEnvFramework)) {
    allBundles.push(execEnvFramework);
  }

  // parse custom sections
  //
  // Note: we do not support artifact list extensions as defined in
  // section 159.7.3 yet. As of 05-12-2022, there is no implementation that
  // supports this
  for (const [section, value] of Object.entries(featureModel)) {
    logger.trace({ fileName: packageFile, section }, 'Parsing section');
    const customSectionEntries = extractArtifactList(section, value);
    allBundles.push(...customSectionEntries);
  }

  // convert bundles to dependencies
  for (const entry of allBundles) {
    const rawGav = typeof entry === 'string' ? entry : entry.id;
    // skip invalid definitions, such as objects without an id set
    if (!rawGav) {
      continue;
    }

    // both '/' and ':' are valid separators, but the Maven datasource
    // expects the separator to be ':'
    const gav = rawGav.replace(/\//g, ':');

    // identifiers support 3-5 parts, see OSGi R8 - 159.2.1 Identifiers
    // groupId ':' artifactId ( ':' type ( ':' classifier )? )? ':' version
    const parts = gav.split(':');
    if (parts.length < 3 || parts.length > 5) {
      deps.push({
        depName: gav,
        skipReason: 'invalid-value',
      });
      continue;
    }
    // parsing should use the last entry for the version
    const currentValue = parts[parts.length - 1];
    const result: PackageDependency = {
      datasource: MavenDatasource.id,
      depName: `${parts[0]}:${parts[1]}`,
    };
    if (currentValue.includes('${')) {
      result.skipReason = 'contains-variable';
    } else {
      result.currentValue = currentValue;
    }

    deps.push(result);
  }

  return deps.length ? { deps } : null;
}

function isSupportedFeatureResourceVersion(
  featureModel: FeatureModel,
  fileName: string,
): boolean {
  const resourceVersion = featureModel['feature-resource-version'];
  if (resourceVersion) {
    const resourceSemVer = coerce(resourceVersion);
    if (!resourceSemVer) {
      logger.debug(
        `Skipping file ${fileName} due to invalid feature-resource-version '${resourceVersion}'`,
      );
      return false;
    }

    // we only support 1.x, although no over version has been defined
    if (!satisfies(resourceSemVer, '^1')) {
      logger.debug(
        `Skipping file ${fileName} due to unsupported feature-resource-version '${resourceVersion}'`,
      );
      return false;
    }
  }

  return true;
}

function extractArtifactList(
  sectionName: string,
  sectionValue: unknown,
): Bundle[] {
  // The 'ARTIFACTS' key is supported by the Sling/OSGi feature model implementation
  if (sectionName.includes(':ARTIFACTS|') && is.array(sectionValue)) {
    return sectionValue as Bundle[];
  }

  return [];
}
