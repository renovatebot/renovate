import { isNonEmptyString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider/index.ts';
import type { ExtractConfig, PackageDependency } from '../types.ts';
import type { TerraformDefinitionFile } from './hcl/types.ts';
import type { ProviderLock } from './lockfile/types.ts';
import { getLockedVersion, massageProviderLookupName } from './util.ts';

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

    if (isNonEmptyString(dep.managerData?.source)) {
      // TODO #22198
      const source = this.sourceExtractionRegex.exec(dep.managerData.source);
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
        const foundLocks = locks.filter(
          (lock) => lock.packageName === dep.packageName,
        );

        if (
          foundLocks.length === 1 &&
          foundLocks[0].registryUrl !==
            TerraformProviderDatasource.defaultRegistryUrls[0]
        ) {
          logger.debug(
            { dep, foundLocks },
            'Terraform: Single lock found for provider with non-default registry URL',
          );
          dep.registryUrls = [foundLocks[0].registryUrl];
        } else if (foundLocks.length > 1) {
          logger.debug(
            { dep, foundLocks },
            'Terraform: Multiple locks found for provider unable to determine registry URL',
          );
        }
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
