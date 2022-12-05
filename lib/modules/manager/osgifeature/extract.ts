import { logger } from '../../../logger';
import { MavenDatasource } from '../../datasource/maven';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

export function extractPackageFile(
    content: string,
    fileName: string,
    config?: ExtractConfig
  ): PackageFile | null {
  
    logger.info("osgifeature.extract(" + fileName + ")")
    const deps: PackageDependency[] = [];

    try {
        const featureModel = JSON.parse(content);
        for ( const bundleIdx in featureModel.bundles ) {
            const entry: string | object = featureModel.bundles[bundleIdx];
            let gav:string
            if ( entry instanceof Object ) {
                gav = (entry as Bundle).id
            } else {
                gav = entry
            }

            // both '/' and ':' are valid separators, but the Maven datasource
            // expects the separator to be ':'
            gav = gav.replaceAll('/', ':')
            // parsing should use the last entry for the version
            const parts = gav.split(':')
            const result:PackageDependency = {
                datasource: MavenDatasource.id,
                depName: `${parts[0]}:${parts[1]}`,
                currentValue: `${parts[2]}`
            }
            deps.push(result)
        }
    } catch (e)  {
        logger.warn("Failed parsing " + fileName)
        return null
        // TODO - better logging?
    }
    

    return deps.length > 0 ? { deps} : null
  }

  interface Bundle {
    id: string;
  }