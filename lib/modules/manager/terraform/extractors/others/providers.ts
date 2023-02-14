import is from '@sindresorhus/is';
import type { PackageDependency } from '../../../types';
import { TerraformProviderExtractor } from '../../base';
import type { TerraformDefinitionFile } from '../../hcl/types';
import type { ProviderLock } from '../../lockfile/types';

export class ProvidersExtractor extends TerraformProviderExtractor {
  getCheckList(): string[] {
    return ['provider'];
  }

  extract(
    hclRoot: TerraformDefinitionFile,
    locks: ProviderLock[]
  ): PackageDependency[] {
    const providerTypes = hclRoot?.provider;
    if (!is.nonEmptyObject(providerTypes)) {
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
          'provider'
        );
        dependencies.push(dep);
      }
    }
    return dependencies;
  }
}
