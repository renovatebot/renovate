import is from '@sindresorhus/is';
import type { PackageDependency } from '../../../types';
import { TerraformProviderExtractor } from '../../base';
import type { ProviderLock } from '../../lockfile/types';

export class RequiredProviderExtractor extends TerraformProviderExtractor {
  extract(hclRoot: any, locks: ProviderLock[]): PackageDependency[] {
    const terraformBlocks = hclRoot?.terraform;
    if (is.nullOrUndefined(terraformBlocks)) {
      return [];
    }

    const dependencies: PackageDependency[] = [];
    for (const terraformBlock of terraformBlocks) {
      const requiredProviders = terraformBlock.required_providers;
      if (is.nullOrUndefined(requiredProviders)) {
        continue;
      }

      for (const requiredProvidersMap of requiredProviders) {
        for (const requiredProviderName of Object.keys(requiredProvidersMap)) {
          const value = requiredProvidersMap[requiredProviderName];

          // name = version declaration method
          let dep: PackageDependency;
          if (typeof value === 'string') {
            dep = {
              currentValue: value,
              managerData: {
                moduleName: requiredProviderName,
              },
            };
          }
          // block declaration aws = { source = 'aws', version = '2.0.0' }
          dep ??= {
            currentValue: value['version'],
            managerData: {
              moduleName: requiredProviderName,
              source: value['source'],
            },
          };
          const massagedDep = this.analyzeTerraformProvider(
            dep,
            locks,
            'required_provider'
          );
          dependencies.push(massagedDep);
        }
      }
    }
    return dependencies;
  }
}
