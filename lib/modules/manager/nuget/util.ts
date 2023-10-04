import { quote } from 'shlex';
import upath from 'upath';
import { XmlDocument, XmlElement } from 'xmldoc';
import { logger } from '../../../logger';
import { findUpLocal, readLocalFile } from '../../../util/fs';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { NugetDatasource, defaultRegistryUrls } from '../../datasource/nuget';
import { parseRegistryUrl } from '../../datasource/nuget/common';
import type { ParsedRegistryUrl } from '../../datasource/nuget/types';
import type { PackageSourceCredential, Registry } from './types';

export async function readFileAsXmlDocument(
  file: string
): Promise<XmlDocument | undefined> {
  try {
    // TODO #22198
    const doc = new XmlDocument((await readLocalFile(file, 'utf8'))!);
    // don't return empty documents
    return doc?.firstChild ? doc : undefined;
  } catch (err) {
    logger.debug({ err, file }, `failed to parse file as XML document`);
    return undefined;
  }
}

const defaultRegistries = defaultRegistryUrls.map(
  (registryUrl) => ({ url: registryUrl } as Registry)
);

export function getDefaultRegistries(): Registry[] {
  return [...defaultRegistries];
}

export async function getConfiguredRegistries(
  packageFile: string
): Promise<Registry[] | undefined> {
  // Valid file names taken from https://github.com/NuGet/NuGet.Client/blob/f64621487c0b454eda4b98af853bf4a528bef72a/src/NuGet.Core/NuGet.Configuration/Settings/Settings.cs#L34
  const nuGetConfigFileNames = ['nuget.config', 'NuGet.config', 'NuGet.Config'];
  // normalize paths, otherwise startsWith can fail because of path delimitter mismatch
  const nuGetConfigPath = await findUpLocal(
    nuGetConfigFileNames,
    upath.dirname(packageFile)
  );
  if (!nuGetConfigPath) {
    return undefined;
  }

  logger.debug(`Found NuGet.config at ${nuGetConfigPath}`);
  const nuGetConfig = await readFileAsXmlDocument(nuGetConfigPath);
  if (!nuGetConfig) {
    return undefined;
  }

  const packageSources = nuGetConfig.childNamed('packageSources');
  if (!packageSources) {
    return undefined;
  }

  const registries = getDefaultRegistries();
  for (const child of packageSources.children) {
    if (child.type === 'element') {
      if (child.name === 'clear') {
        logger.debug(`clearing registry URLs`);
        registries.length = 0;
      } else if (child.name === 'add') {
        const isHttpUrl = regEx(/^https?:\/\//i).test(child.attr.value);
        if (isHttpUrl) {
          let registryUrl = child.attr.value;
          if (child.attr.protocolVersion) {
            registryUrl += `#protocolVersion=${child.attr.protocolVersion}`;
          }
          logger.debug(`Adding registry URL ${registryUrl}`);
          registries.push({
            name: child.attr.key,
            url: registryUrl,
          });
        } else {
          logger.debug(
            { registryUrl: child.attr.value },
            'ignoring local registry URL'
          );
        }
      }
      // child.name === 'remove' not supported
    }
  }
  return registries;
}

export function findVersion(parsedXml: XmlDocument): XmlElement | null {
  for (const tag of ['Version', 'VersionPrefix']) {
    for (const l1Elem of parsedXml.childrenNamed('PropertyGroup')) {
      for (const l2Elem of l1Elem.childrenNamed(tag)) {
        return l2Elem;
      }
    }
  }
  return null;
}

export async function formatNuGetConfigXmlContents(
  packageFileName: string
): Promise<string> {
  let contents = `<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n<packageSources>\n`;

  const registries =
    (await getConfiguredRegistries(packageFileName)) ?? getDefaultRegistries();

  let unnamedRegistryCount = 0;

  const credentials: PackageSourceCredential[] = [];

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
      const credential: PackageSourceCredential = {
        name: registryName,
        password,
        username,
      };
      credentials.push(credential);
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

  contents += '</configuration>\n';

  return contents;
}

function formatPackageSourceElement(
  registryInfo: ParsedRegistryUrl,
  name: string
): string {
  let element = `<add key=${quote(name)} value=${quote(registryInfo.feedUrl)} `;

  if (registryInfo.protocolVersion) {
    element += `protocolVersion=${quote(
      registryInfo.protocolVersion.toString()
    )} `;
  }

  return (element += '/>\n');
}

const escapeXmlElementNameRegExp = regEx(/(?!(\d|\w|-|\.))./g);
function formatPackageSourceCredentialElement(
  credential: PackageSourceCredential
): string {
  const escapedName = credential.name.replace(
    escapeXmlElementNameRegExp,
    function (match) {
      return '__x' + match.charCodeAt(0) + '__';
    }
  );

  let packageSourceCredential = `<${escapedName}>\n`;

  if (credential.username) {
    packageSourceCredential += `<add key="Username" value=${quote(
      credential.username
    )} />\n`;
  }

  if (credential.password) {
    packageSourceCredential += `<add key="ClearTextPassword" value=${quote(
      credential.password
    )} />\n`;
  }

  packageSourceCredential += `</${escapedName}>\n`;

  return packageSourceCredential;
}
