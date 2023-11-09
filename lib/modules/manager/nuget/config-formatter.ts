import is from '@sindresorhus/is';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
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

    if (is.nonEmptyString(password) || is.nonEmptyString(username)) {
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
  name: string,
): string {
  let element = `<add key="${name}" value="${registryInfo.feedUrl}" `;

  if (registryInfo.protocolVersion) {
    element += `protocolVersion="${registryInfo.protocolVersion}" `;
  }

  return `${element}/>\n`;
}

function formatPackageSourceCredentialElement(
  credential: PackageSourceCredential,
): string {
  const escapedName = escapeName(credential.name);

  let packageSourceCredential = `<${escapedName}>\n`;

  if (credential.username) {
    packageSourceCredential += `<add key="Username" value="${credential.username}" />\n`;
  }

  if (credential.password) {
    packageSourceCredential += `<add key="ClearTextPassword" value="${credential.password}" />\n`;
  }

  packageSourceCredential += `<add key="ValidAuthenticationTypes" value="basic" />`;

  packageSourceCredential += `</${escapedName}>\n`;

  return packageSourceCredential;
}

function formatPackageSource(packageSourceMap: PackageSourceMap): string {
  let packageSource = `<packageSource key="${packageSourceMap.name}">\n`;

  for (const pattern of packageSourceMap.patterns) {
    packageSource += `<package pattern="${pattern}" />\n`;
  }

  return `${packageSource}</packageSource>\n`;
}

const charactersToEscape = regEx(/[^A-Za-z0-9\-_.]/);

function escapeName(name: string): string {
  let escapedName = '';
  for (let i = 0; i < name.length; i++) {
    const char = name[i];
    if (char.match(charactersToEscape)) {
      escapedName += `__x${char
        .codePointAt(0)!
        .toString(16)
        .padStart(4, '0')}__`;
    } else {
      escapedName += char;
    }
  }

  return escapedName;
}
