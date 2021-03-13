import { XmlDocument, XmlElement, XmlNode } from 'xmldoc';
import * as datasourceNuget from '../../datasource/nuget';
import { logger } from '../../logger';
import { getSiblingFileName, localPathExists } from '../../util/fs';
import { hasKey } from '../../util/object';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { DotnetToolsManifest } from './types';
import { getConfiguredRegistries } from './util';

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
const elemNames = new Set([
  'PackageReference',
  'PackageVersion',
  'DotNetCliToolReference',
  'GlobalPackageReference',
]);

function isXmlElem(node: XmlNode): boolean {
  return hasKey('name', node);
}

function extractDepsFromXml(xmlNode: XmlDocument): PackageDependency[] {
  const results: PackageDependency[] = [];
  const todo: XmlElement[] = [xmlNode];
  while (todo.length) {
    const child = todo.pop();
    const { name, attr } = child;

    if (elemNames.has(name)) {
      const depName = attr?.Include || attr?.Update;
      const version =
        attr?.Version ||
        child.valueWithPath('Version') ||
        attr?.VersionOverride ||
        child.valueWithPath('VersionOverride');
      const currentValue = checkVersion
        ?.exec(version)
        ?.groups?.currentValue?.trim();
      if (depName && currentValue) {
        results.push({
          datasource: datasourceNuget.id,
          depType: 'nuget',
          depName,
          currentValue,
        });
      }
    } else {
      todo.push(...(child.children.filter(isXmlElem) as XmlElement[]));
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

  const registries = await getConfiguredRegistries(
    packageFile,
    config.localDir
  );
  const registryUrls = registries
    ? registries.map((registry) => registry.url)
    : undefined;

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
    }));
  } catch (err) {
    logger.debug({ err }, `Failed to parse ${packageFile}`);
  }
  const res: PackageFile = { deps };
  const lockFileName = getSiblingFileName(packageFile, 'packages.lock.json');
  // istanbul ignore if
  if (await localPathExists(lockFileName)) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
