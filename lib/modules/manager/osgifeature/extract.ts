import * as json5 from 'json5';
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
        const currentValue = parts[parts.length - 1];
        const result: PackageDependency = {
          datasource: MavenDatasource.id,
          depName: `${parts[0]}:${parts[1]}`,
        };
        if (currentValue.indexOf('${') === 0) {
          result.skipReason = 'contains-variable';
        } else {
          result.currentValue = currentValue;
        }

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

function extractArtifactList(sectionName: string, sectionValue: any): any[] {
  // Compendiun R8 159.4: bundles entry
  // The 'ARTIFACTS' key is supported by the Sling/OSGi feature model implementation
  if ('bundles' === sectionName || sectionName.indexOf(':ARTIFACTS|') > 0) {
    return sectionValue as any[];
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

interface Bundle {
  id: string;
}
