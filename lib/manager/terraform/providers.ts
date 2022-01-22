import is from '@sindresorhus/is';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider';
import { regEx } from '../../util/regex';
import type { PackageDependency } from '../types';
import type { ProviderLock } from './lockfile/types';
import { getLockedVersion, massageProviderLookupName } from './util';

export const sourceExtractionRegex = regEx(
  /^(?:(?<hostname>(?:[a-zA-Z0-9]+\.+)+[a-zA-Z0-9]+)\/)?(?:(?<namespace>[^/]+)\/)?(?<type>[^/]+)/
);

export function extractTerraformProvider(
  providers: any[],
  locks: ProviderLock[]
): PackageDependency[] {
  return Object.keys(providers)
    .flatMap((provider) => {
      return providers[provider].map((value) => {
        return {
          currentValue: value.version,
          managerData: {
            moduleName: provider,
            source: value.source,
          },
        };
      });
    })
    .map((value) => analyzeTerraformProvider(value, locks));
}

export function analyzeTerraformProvider(
  dep: PackageDependency,
  locks: ProviderLock[]
): PackageDependency {
  dep.depType = 'provider';
  dep.depName = dep.managerData.moduleName;
  dep.datasource = TerraformProviderDatasource.id;

  if (is.nonEmptyString(dep.managerData.source)) {
    const source = sourceExtractionRegex.exec(dep.managerData.source);
    if (!source) {
      dep.skipReason = 'unsupported-url';
      return dep;
    }

    // builtin providers https://github.com/terraform-providers
    if (source.groups.namespace === 'terraform-providers') {
      dep.registryUrls = [`https://releases.hashicorp.com`];
    } else if (source.groups.hostname) {
      dep.registryUrls = [`https://${source.groups.hostname}`];
      dep.lookupName = `${source.groups.namespace}/${source.groups.type}`;
    } else {
      dep.lookupName = dep.managerData.source;
    }
  }
  massageProviderLookupName(dep);

  dep.lockedVersion = getLockedVersion(dep, locks);

  if (!dep.currentValue) {
    dep.skipReason = 'no-version';
  }

  return dep;
}
