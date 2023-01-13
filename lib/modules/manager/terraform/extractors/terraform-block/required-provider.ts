import is from '@sindresorhus/is';
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
    locks: ProviderLock[]
  ): PackageDependency[] {
    const terraformBlocks = hclRoot?.terraform;
    if (is.nullOrUndefined(terraformBlocks)) {
      return [];
    }

    const deps: PackageDependency[] = [];
    for (const terraformBlock of terraformBlocks) {
      const requiredProviders = terraformBlock.required_providers;
      if (is.nullOrUndefined(requiredProviders)) {
        continue;
      }

      const entries: [string, TerraformRequiredProvider | string][] =
        requiredProviders.flatMap(Object.entries);
      for (const [requiredProviderName, value] of entries) {
        // name = version declaration method
        if (is.string(value)) {
          deps.push({
            currentValue: value,
            managerData: {
              moduleName: requiredProviderName,
            },
          });
          continue;
        }
        // block declaration aws = { source = 'aws', version = '2.0.0' }
        deps.push({
          currentValue: value['version'],
          managerData: {
            moduleName: requiredProviderName,
            source: value['source'],
          },
        });
      }
    }
    const dependencies = deps.map((dep) =>
      this.analyzeTerraformProvider(dep, locks, 'required_provider')
    );
    return dependencies;
  }
}
