import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider';
import type { ExtractConfig, PackageDependency } from '../types';
import type { TerraformDefinitionFile } from './hcl/types';
import type { ProviderLock } from './lockfile/types';
import { getLockedVersion, massageProviderLookupName } from './util';

export abstract class DependencyExtractor {
  /**
   * Get a list of signals which can be used to scan for potential processable content
   * @return a list of content signals
   */
  abstract getCheckList(): string[];

  /**
   * Extract dependencies from a HCL object
   * @param hclRoot HCL parsing artifact.
   * @param locks currently existing locks
   */
  abstract extract(
    hclRoot: TerraformDefinitionFile,
    locks: ProviderLock[],
    config: ExtractConfig,
  ): PackageDependency[];
}

export abstract class TerraformProviderExtractor extends DependencyExtractor {
  sourceExtractionRegex = regEx(
    /^(?:(?<hostname>(?:[a-zA-Z0-9-_]+\.+)+[a-zA-Z0-9-_]+)\/)?(?:(?<namespace>[^/]+)\/)?(?<type>[^/]+)/,
  );

  protected analyzeTerraformProvider(
    dep: PackageDependency,
    locks: ProviderLock[],
    depType: string,
  ): PackageDependency {
    dep.depType = depType;
    dep.depName = dep.managerData?.moduleName;
    dep.datasource = TerraformProviderDatasource.id;

    if (is.nonEmptyString(dep.managerData?.source)) {
      // TODO #22198
      const source = this.sourceExtractionRegex.exec(dep.managerData!.source);
      if (!source?.groups) {
        dep.skipReason = 'unsupported-url';
        return dep;
      }

      // buildin providers https://github.com/terraform-providers
      if (source.groups.namespace === 'terraform-providers') {
        dep.registryUrls = [`https://releases.hashicorp.com`];
      } else if (source.groups.hostname) {
        dep.registryUrls = [`https://${source.groups.hostname}`];
        dep.packageName = `${source.groups.namespace}/${source.groups.type}`;
      } else {
        dep.packageName = dep.managerData?.source;
      }
    }
    massageProviderLookupName(dep);

    dep.lockedVersion = getLockedVersion(dep, locks);

    if (!dep.currentValue) {
      dep.skipReason = 'unspecified-version';
    }

    return dep;
  }
}
