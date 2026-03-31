import { isNonEmptyString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider/index.ts';
import type { ExtractConfig, PackageDependency } from '../types.ts';
import type { TerraformDepType } from './dep-types.ts';
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
  ): PackageDependency<Record<string, any>, TerraformDepType>[];
}

export abstract class TerraformProviderExtractor extends DependencyExtractor {
  sourceExtractionRegex = regEx(
    /^(?:(?<hostname>(?:[a-zA-Z0-9-_]+\.+)+[a-zA-Z0-9-_]+)\/)?(?:(?<namespace>[^/]+)\/)?(?<type>[^/]+)/,
  );

  protected analyzeTerraformProvider(
    dep: PackageDependency,
    locks: ProviderLock[],
    depType: TerraformDepType,
  ): PackageDependency<Record<string, any>, TerraformDepType> {
    const result = { ...dep, depType };
    result.depName = result.managerData?.moduleName;
    result.datasource = TerraformProviderDatasource.id;

    if (isNonEmptyString(result.managerData?.source)) {
      // TODO #22198
      const source = this.sourceExtractionRegex.exec(result.managerData.source);
      if (!source?.groups) {
        result.skipReason = 'unsupported-url';
        return result;
      }

      // buildin providers https://github.com/terraform-providers
      if (source.groups.namespace === 'terraform-providers') {
        result.registryUrls = [`https://releases.hashicorp.com`];
      } else if (source.groups.hostname) {
        result.registryUrls = [`https://${source.groups.hostname}`];
        result.packageName = `${source.groups.namespace}/${source.groups.type}`;
      } else {
        result.packageName = result.managerData?.source;
        const foundLocks = locks.filter(
          (lock) => lock.packageName === result.packageName,
        );

        if (
          foundLocks.length === 1 &&
          foundLocks[0].registryUrl !==
            TerraformProviderDatasource.defaultRegistryUrls[0]
        ) {
          logger.debug(
            { dep: result, foundLocks },
            'Terraform: Single lock found for provider with non-default registry URL',
          );
          result.registryUrls = [foundLocks[0].registryUrl];
        } else if (foundLocks.length > 1) {
          logger.debug(
            { dep: result, foundLocks },
            'Terraform: Multiple locks found for provider unable to determine registry URL',
          );
        }
      }
    }
    massageProviderLookupName(result);

    result.lockedVersion = getLockedVersion(result, locks);

    if (!result.currentValue) {
      result.skipReason = 'unspecified-version';
    }

    return result;
  }
}
