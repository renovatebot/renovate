import { logger } from '../../../logger';
import { MavenDatasource } from '../../datasource/maven';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

export function extractPackageFile(
  content: string,
  fileName: string,
  config?: ExtractConfig
): PackageFile | null {
  // References:
  // - OSGi compendium release 8 ( https://docs.osgi.org/specification/osgi.cmpn/8.0.0/service.feature.html )
  // - The Sling implementation of the feature model ( https://sling.apache.org/documentation/development/feature-model.html )
  logger.debug('osgifeature.extract(' + fileName + ')');

  const deps: PackageDependency[] = [];
  try {
    // Compendium R8 159.3: JS comments are supported
    // We only support inline comments, for now
    const jsonContent = content.replace(/\/\/(.*)/, '');
    const featureModel = JSON.parse(jsonContent);

    for (const [section, value] of Object.entries(featureModel)) {
      // Note: we do not support artifact list extensions as defined in
      // section 159.7.3 yet. As of 05-12-2022, there is no implementation that
      // supports this
      if (!isArtifactsEntry(section)) {
        continue;
      }

      for (const entry of value as any) {
        let gav: string;
        if (entry instanceof Object) {
          gav = (entry as Bundle).id;
        } else {
          gav = entry as string;
        }

        // both '/' and ':' are valid separators, but the Maven datasource
        // expects the separator to be ':'
        gav = gav.replaceAll('/', ':');

        // parsing should use the last entry for the version
        const parts = gav.split(':');
        const result: PackageDependency = {
          datasource: MavenDatasource.id,
          depName: `${parts[0]}:${parts[1]}`,
          currentValue: `${parts[parts.length - 1]}`,
        };
        deps.push(result);
      }
    }
  } catch (e) {
    logger.warn('Failed parsing ' + fileName + ': ' + (e as Error).message);
    return null;
    // TODO - better logging?
  }

  return deps.length > 0 ? { deps } : null;
}

function isArtifactsEntry(sectionName: string): boolean {
  // Compendiun R8 159.4: bundles entry
  // The 'ARTIFACTS' key is supported by the Sling/OSGi feature model implementation
  return 'bundles' === sectionName || sectionName.indexOf(':ARTIFACTS|') > 0;
}

interface Bundle {
  id: string;
}
