import * as path from 'path';
import findUp from 'find-up';
import { XmlDocument } from 'xmldoc';
import * as datasourceNuget from '../../datasource/nuget';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { clone } from '../../util/clone';
import { readFile } from '../../util/fs';
import { get } from '../../versioning';
import * as semverVersioning from '../../versioning/semver';
import { ExtractConfig, PackageDependency, PackageFile } from '../common';
import { DotnetToolsManifest } from './types';

async function readFileAsXmlDocument(file: string): Promise<XmlDocument> {
  try {
    return new XmlDocument(await readFile(file, 'utf8'));
  } catch (err) {
    logger.debug({ err }, `failed to parse '${file}' as XML document`);
    return undefined;
  }
}

async function determineRegistryUrls(
  packageFile: string,
  localDir: string
): Promise<string[]> {
  // Valid file names taken from https://github.com/NuGet/NuGet.Client/blob/f64621487c0b454eda4b98af853bf4a528bef72a/src/NuGet.Core/NuGet.Configuration/Settings/Settings.cs#L34
  const nuGetConfigFileNames = ['nuget.config', 'NuGet.config', 'NuGet.Config'];
  const nuGetConfigPath = await findUp(nuGetConfigFileNames, {
    cwd: path.dirname(path.join(localDir, packageFile)),
    type: 'file',
  });

  if (nuGetConfigPath?.startsWith(localDir) !== true) {
    return undefined;
  }

  logger.debug({ nuGetConfigPath }, 'found NuGet.config');
  const nuGetConfig = await readFileAsXmlDocument(nuGetConfigPath);
  if (!nuGetConfig) {
    return undefined;
  }

  const packageSources = nuGetConfig.childNamed('packageSources');
  if (!packageSources) {
    return undefined;
  }

  const registryUrls = clone(datasourceNuget.defaultRegistryUrls);
  for (const child of packageSources.children) {
    if (child.type === 'element') {
      if (child.name === 'clear') {
        logger.debug(`clearing registry URLs`);
        registryUrls.length = 0;
      } else if (child.name === 'add') {
        const isHttpUrl = /^https?:\/\//i.test(child.attr.value);
        if (isHttpUrl) {
          let registryUrl = child.attr.value;
          if (child.attr.protocolVersion) {
            registryUrl += `#protocolVersion=${child.attr.protocolVersion}`;
          }
          logger.debug({ registryUrl }, 'adding registry URL');
          registryUrls.push(registryUrl);
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
  return registryUrls;
}

/**
 * https://docs.microsoft.com/en-us/nuget/concepts/package-versioning
 * This article mentions that  Nuget 3.x and later tries to restore the lowest possible version
 * regarding to given version range.
 * 1.3.4 equals [1.3.4,)
 * Due to guarantee that an update of package version will result in its usage by the next restore + build operation,
 * only following constrained versions make sense
 * 1.3.4, [1.3.4], [1.3.4, ], [1.3.4, )
 * The update of the right boundary does not make sense regarding to the lowest version restore rule,
 * so we don't include it in the extracting regexp
 */
const checkVersion = /^\s*(?:[[])?(?:(?<currentValue>[^"(,[\]]+)\s*(?:,\s*[)\]]|])?)\s*$/;

function extractDepsFromXml(xmlNode: XmlDocument): PackageDependency[] {
  const results = [];
  const itemGroups = xmlNode.childrenNamed('ItemGroup');
  for (const itemGroup of itemGroups) {
    const relevantChildren = [
      ...itemGroup.childrenNamed('PackageReference'),
      ...itemGroup.childrenNamed('DotNetCliToolReference'),
      ...itemGroup.childrenNamed('GlobalPackageReference'),
    ];
    for (const child of relevantChildren) {
      const { attr } = child;
      const depName = attr?.Include || attr?.Update;
      const version =
        attr?.Version ||
        child.valueWithPath('Version') ||
        attr?.VersionOverride ||
        child.valueWithPath('VersionOverride');
      const currentValue = version
        ?.match(checkVersion)
        ?.groups?.currentValue?.trim();
      if (depName && currentValue) {
        results.push({
          datasource: datasourceNuget.id,
          depType: 'nuget',
          depName,
          currentValue,
        });
      }
    }
  }
  return results;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PackageFile | null> {
  logger.trace({ packageFile }, 'nuget.extractPackageFile()');
  const versioning = get(config.versioning || semverVersioning.id);

  const registryUrls = await determineRegistryUrls(
    packageFile,
    config.localDir
  );

  if (packageFile.endsWith('.config/dotnet-tools.json')) {
    const deps: PackageDependency[] = [];
    let manifest: DotnetToolsManifest;

    try {
      manifest = JSON.parse(content);
    } catch (err) {
      logger.debug({ fileName: packageFile }, 'Invalid JSON');
      return null;
    }

    if (manifest.version !== 1) {
      logger.debug({ contents: manifest }, 'Unsupported dotnet tools version');
      return null;
    }

    for (const depName of Object.keys(manifest.tools)) {
      const tool = manifest.tools[depName];
      const currentValue = tool.version;
      const dep: PackageDependency = {
        depType: 'nuget',
        depName,
        currentValue,
        datasource: datasourceNuget.id,
      };
      if (registryUrls) {
        dep.registryUrls = registryUrls;
      }

      deps.push(dep);
    }

    return { deps };
  }

  let deps: PackageDependency[] = [];
  try {
    const parsedXml = new XmlDocument(content);
    deps = extractDepsFromXml(parsedXml).map((dep) => ({
      ...dep,
      ...(registryUrls && { registryUrls }),
      ...(!versioning.isVersion(dep.currentValue) && {
        skipReason: SkipReason.NotAVersion,
      }),
    }));
    return { deps };
  } catch (err) {
    logger.debug({ err }, `Failed to parse ${packageFile}`);
  }
  return { deps };
}
