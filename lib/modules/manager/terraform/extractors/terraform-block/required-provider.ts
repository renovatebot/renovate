import { isNullOrUndefined, isString } from '@sindresorhus/is';
import type { PackageDependency } from '../../../types.ts';
import { TerraformProviderExtractor } from '../../base.ts';
import type { TerraformDepType } from '../../dep-types.ts';
import type {
  TerraformDefinitionFile,
  TerraformRequiredProvider,
} from '../../hcl/types.ts';
import type { ProviderLock } from '../../lockfile/types.ts';

export class RequiredProviderExtractor extends TerraformProviderExtractor {
  getCheckList(): string[] {
    return ['required_providers'];
  }

  extract(
    hclRoot: TerraformDefinitionFile,
    locks: ProviderLock[],
  ): PackageDependency<Record<string, any>, TerraformDepType>[] {
    const terraformBlocks = hclRoot?.terraform;
    if (isNullOrUndefined(terraformBlocks)) {
      return [];
    }

    const dependencies: PackageDependency<
      Record<string, any>,
      TerraformDepType
    >[] = [];
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
