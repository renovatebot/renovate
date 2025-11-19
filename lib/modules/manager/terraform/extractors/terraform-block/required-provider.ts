import { isNullOrUndefined, isString } from '@sindresorhus/is';
import type { PackageDependency } from '../../../types';
import { TerraformProviderExtractor } from '../../base';
import type {
  TerraformDefinitionFile,
  TerraformRequiredProvider,
} from '../../hcl/types';
import type { ProviderLock } from '../../lockfile/types';

export class RequiredProviderExtractor extends TerraformProviderExtractor {
  getCheckList(): string[] {
    return ['required_providers'];
  }

  extract(
    hclRoot: TerraformDefinitionFile,
    locks: ProviderLock[],
  ): PackageDependency[] {
    const terraformBlocks = hclRoot?.terraform;
    if (isNullOrUndefined(terraformBlocks)) {
      return [];
    }

    const dependencies: PackageDependency[] = [];
    for (const terraformBlock of terraformBlocks) {
      const requiredProviders = terraformBlock.required_providers;
      if (isNullOrUndefined(requiredProviders)) {
        continue;
      }

      const entries: [string, TerraformRequiredProvider | string][] =
        requiredProviders.flatMap(Object.entries);
      for (const [requiredProviderName, value] of entries) {
        // name = version declaration method
        let dep: PackageDependency;
        if (isString(value)) {
          dep = {
            currentValue: value,
            managerData: {
              moduleName: requiredProviderName,
            },
          };
        } else {
          // block declaration aws = { source = 'aws', version = '2.0.0' }
          dep = {
            currentValue: value.version,
            managerData: {
              moduleName: requiredProviderName,
              source: value.source,
            },
          };
        }
        dependencies.push(
          this.analyzeTerraformProvider(dep, locks, 'required_provider'),
        );
      }
    }
    return dependencies;
  }
}
