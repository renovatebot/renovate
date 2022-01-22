import type { PackageDependency } from '../types';
import type { ProviderLock } from './lockfile/types';
import { analyzeTerraformProvider } from './providers';

export function extractTerraformRequiredProviders(
  requiredProviders: any,
  locks: ProviderLock[]
): PackageDependency[] {
  if (!requiredProviders) {
    return [];
  }
  return requiredProviders.flatMap((required_provider) => {
    return Object.keys(required_provider)
      .flatMap((value) => {
        const test = required_provider[value];

        // name = version declaration method
        if (typeof test === 'string') {
          return {
            currentValue: test,
            managerData: {
              moduleName: value,
            },
          };
        }

        // block declaration aws = { source = 'aws', version = '2.0.0' }
        return {
          currentValue: test['version'],
          managerData: {
            moduleName: value,
            source: test['source'],
          },
        };
      })
      .flatMap((value) => {
        return analyzeTerraformRequiredProvider(value, locks);
      });
  });
}

function analyzeTerraformRequiredProvider(
  dep: PackageDependency,
  locks: ProviderLock[]
): PackageDependency {
  analyzeTerraformProvider(dep, locks);
  dep.depType = `required_provider`;
  return dep;
}
