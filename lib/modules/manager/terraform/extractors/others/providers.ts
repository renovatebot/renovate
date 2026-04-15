import { isNullOrUndefined, isPlainObject } from '@sindresorhus/is';
import { logger } from '../../../../../logger/index.ts';
import type { PackageDependency } from '../../../types.ts';
import { TerraformProviderExtractor } from '../../base.ts';
import type { TerraformDefinitionFile } from '../../hcl/types.ts';
import type { ProviderLock } from '../../lockfile/types.ts';

export class ProvidersExtractor extends TerraformProviderExtractor {
  getCheckList(): string[] {
    return ['provider'];
  }

  extract(
    hclRoot: TerraformDefinitionFile,
    locks: ProviderLock[],
  ): PackageDependency[] {
    const providerTypes = hclRoot?.provider;
    if (isNullOrUndefined(providerTypes)) {
      return [];
    }

    /* v8 ignore next 7 -- needs test */
    if (!isPlainObject(providerTypes)) {
      logger.debug(
        { providerTypes },
        'Terraform: unexpected `providerTypes` value',
      );
      return [];
    }

    const dependencies = [];
    for (const providerTypeName of Object.keys(providerTypes)) {
      for (const providerTypeElement of providerTypes[providerTypeName]) {
        const dep = this.analyzeTerraformProvider(
          {
            currentValue: providerTypeElement.version,
            managerData: {
              moduleName: providerTypeName,
            },
          },
          locks,
          'provider',
        );
        dependencies.push(dep);
      }
    }
    return dependencies;
  }
}
