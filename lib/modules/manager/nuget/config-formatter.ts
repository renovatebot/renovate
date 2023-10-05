import * as hostRules from '../../../util/host-rules';
import { NugetDatasource } from '../../datasource/nuget';
import { parseRegistryUrl } from '../../datasource/nuget/common';
import type { ParsedRegistryUrl } from '../../datasource/nuget/types';
import type {
  PackageSourceCredential,
  PackageSourceMap,
  Registry,
} from './types';

export function createNuGetConfigXml(registries: Registry[]): string {
  let contents = `<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n<packageSources>\n`;
  let unnamedRegistryCount = 0;

  const credentials: PackageSourceCredential[] = [];
  const packageSourceMaps: PackageSourceMap[] = [];

  for (const registry of registries) {
    const registryName =
      registry.name ?? `Package source ${++unnamedRegistryCount}`;
    const registryInfo = parseRegistryUrl(registry.url);

    contents += formatPackageSourceElement(registryInfo, registryName);

    const { password, username } = hostRules.find({
      hostType: NugetDatasource.id,
      url: registry.url,
    });

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (password || username) {
      credentials.push({
        name: registryName,
        password,
        username,
      });
    }

    if (registry.sourceMappedPackagePatterns) {
      packageSourceMaps.push({
        name: registryName,
        patterns: registry.sourceMappedPackagePatterns,
      });
    }
  }

  contents += '</packageSources>\n';

  if (credentials.length > 0) {
    contents += '<packageSourceCredentials>\n';

    for (const credential of credentials) {
      contents += formatPackageSourceCredentialElement(credential);
    }

    contents += '</packageSourceCredentials>\n';
  }

  if (packageSourceMaps.length > 0) {
    contents += '<packageSourceMapping>\n';
    for (const packageSourceMap of packageSourceMaps) {
      contents += formatPackageSource(packageSourceMap);
    }
    contents += '</packageSourceMapping>';
  }

  contents += '</configuration>\n';

  return contents;
}

function formatPackageSourceElement(
  registryInfo: ParsedRegistryUrl,
  name: string
): string {
  let element = `<add key="${name}" value="${registryInfo.feedUrl}" `;

  if (registryInfo.protocolVersion) {
    element += `protocolVersion="${registryInfo.protocolVersion.toString()}" `;
  }

  return (element += '/>\n');
}

function formatPackageSourceCredentialElement(
  credential: PackageSourceCredential
): string {
  const escapedName = credential.name.replace(
    /(?!(\d|\w|-|\.))./g,
    function (match) {
      return '__x' + match.codePointAt(0)?.toString(16).padStart(4, '0') + '__';
    }
  );

  let packageSourceCredential = `<${escapedName}>\n`;

  if (credential.username) {
    packageSourceCredential += `<add key="Username" value="${credential.username}" />\n`;
  }

  if (credential.password) {
    packageSourceCredential += `<add key="ClearTextPassword" value="${credential.password}" />\n`;
  }

  packageSourceCredential += `</${escapedName}>\n`;

  return packageSourceCredential;
}

function formatPackageSource(packageSourceMap: PackageSourceMap): string {
  let packageSource = `<packageSource key="${packageSourceMap.name}">\n`;

  for (const pattern of packageSourceMap.patterns) {
    packageSource += `<package pattern="${pattern}" />\n`;
  }

  packageSource += '</packageSource>\n';
  return packageSource;
}
