import { ContributionQueryOptions } from 'azure-devops-node-api/interfaces/ExtensionManagementInterfaces';
import * as json5 from 'json5';
import { logger } from '../../../logger';
import { MavenDatasource } from '../../datasource/maven';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { Bundle } from './types';

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
    const featureModel = json5.parse(content);

    for (const [section, value] of Object.entries(featureModel)) {
      // Note: we do not support artifact list extensions as defined in
      // section 159.7.3 yet. As of 05-12-2022, there is no implementation that
      // supports this

      logger.debug({ fileName, section }, 'Parsing section');
      for (const entry of extractArtifactList(section, value)) {
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
    }
  } catch (e) {
    logger.warn(`Failed parsing ${fileName}: ${(e as Error).message}`);
    return null;
    // TODO - better logging?
  }

  return deps.length ? { deps } : null;
}

function extractArtifactList(sectionName: string, sectionValue: any): Bundle[] {
  // Compendiun R8 159.4: bundles entry
  // The 'ARTIFACTS' key is supported by the Sling/OSGi feature model implementation
  if ('bundles' === sectionName || sectionName.includes(':ARTIFACTS|')) {
    return sectionValue as Bundle[];
  }

  // The 'execution-environment' key is supported by the Sling/OSGi feature model implementation
  if (
    'execution-environment:JSON|false' === sectionName &&
    'framework' in sectionValue
  ) {
    return [sectionValue.framework];
  }

  return [];
}
