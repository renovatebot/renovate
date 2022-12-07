import * as json5 from 'json5';
import { coerce, satisfies } from 'semver';
import { logger } from '../../../logger';
import { MavenDatasource } from '../../datasource/maven';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { Bundle, FeatureModel } from './types';

export function extractPackageFile(
  content: string,
  fileName: string,
  config?: ExtractConfig
): PackageFile | null {
  // References:
  // - OSGi compendium release 8 ( https://docs.osgi.org/specification/osgi.cmpn/8.0.0/service.feature.html )
  // - The Sling implementation of the feature model ( https://sling.apache.org/documentation/development/feature-model.html )
  logger.debug({ fileName }, 'osgifeature.extractPackageFile');

  const deps: PackageDependency[] = [];
  try {
    // Compendium R8 159.3: JS comments are supported
    const featureModel = json5.parse<FeatureModel>(content);

    // Compendium R8 159.9: resource versioning
    if (!isSupportedFeatureResourceVersion(featureModel, fileName)) {
      return null;
    }

    const allBundles: Bundle[] = [];
    // OSGi Compendium R8 159.4: bundles entry
    featureModel.bundles?.forEach((bundle) => {
      allBundles.push(bundle);
    });

    // The 'execution-environment' key is supported by the Sling/OSGi feature model implementation
    if (featureModel['execution-environment:JSON|false']?.['framework']) {
      allBundles.push(
        featureModel['execution-environment:JSON|false']['framework']
      );
    }

    // parse custom sections
    //
    // Note: we do not support artifact list extensions as defined in
    // section 159.7.3 yet. As of 05-12-2022, there is no implementation that
    // supports this
    for (const [section, value] of Object.entries(featureModel)) {
      logger.debug({ fileName, section }, 'Parsing section');
      const customSectionEntries = extractArtifactList(section, value);
      customSectionEntries.forEach((bundle) => allBundles.push(bundle));
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
      const gav = rawGav.replaceAll('/', ':');

      // identifiers support 3-5 parts, see OSGi R8 - 159.2.1 Identifiers
      // groupId ':' artifactId ( ':' type ( ':' classifier )? )? ':' version
      const parts = gav.split(':');
      if (parts.length < 3 || parts.length > 5) {
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
  } catch (e) {
    logger.warn(`Failed parsing ${fileName}: ${(e as Error).message}`);
    return null;
    // TODO - better logging?
  }

  return deps.length ? { deps } : null;
}

function isSupportedFeatureResourceVersion(
  featureModel: FeatureModel,
  fileName: string
): boolean {
  const resourceVersion = featureModel['feature-resource-version'];
  if (resourceVersion) {
    const resourceSemVer = coerce(resourceVersion);
    if (!resourceSemVer) {
      logger.debug(
        { fileName, resourceVersion },
        'Skipping due to invalid feature-resource-version'
      );
      return false;
    }

    // we only support 1.x, although no over version has been defined
    if (!satisfies(resourceSemVer, '^1')) {
      logger.debug(
        { fileName, resourceVersion },
        'Skipping due to unsupported feature-resource-version'
      );
      return false;
    }
  }

  return true;
}

function extractArtifactList(sectionName: string, sectionValue: any): Bundle[] {
  // The 'ARTIFACTS' key is supported by the Sling/OSGi feature model implementation
  if (sectionName.includes(':ARTIFACTS|')) {
    return sectionValue as Bundle[];
  }

  return [];
}
