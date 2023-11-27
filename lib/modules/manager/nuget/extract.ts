import is from '@sindresorhus/is';
import { XmlDocument, XmlElement, XmlNode } from 'xmldoc';
import { logger } from '../../../logger';
import { getSiblingFileName, localPathExists } from '../../../util/fs';
import { hasKey } from '../../../util/object';
import { regEx } from '../../../util/regex';
import { NugetDatasource } from '../../datasource/nuget';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { extractMsbuildGlobalManifest } from './extract/global-manifest';
import type { DotnetToolsManifest } from './types';
import { findVersion, getConfiguredRegistries } from './util';

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
const checkVersion = regEx(
  `^\\s*(?:[[])?(?:(?<currentValue>[^"(,[\\]]+)\\s*(?:,\\s*[)\\]]|])?)\\s*$`,
);
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
    const child = todo.pop()!;
    const { name, attr } = child;

    if (elemNames.has(name)) {
      const depName = attr?.Include || attr?.Update;
      const version =
        attr?.Version ??
        child.valueWithPath('Version') ??
        attr?.VersionOverride ??
        child.valueWithPath('VersionOverride');
      const currentValue = is.nonEmptyStringAndNotWhitespace(version)
        ? checkVersion.exec(version)?.groups?.currentValue?.trim()
        : undefined;
      if (depName && currentValue) {
        results.push({
          datasource: NugetDatasource.id,
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
  _config: ExtractConfig,
): Promise<PackageFileContent | null> {
  logger.trace(`nuget.extractPackageFile(${packageFile})`);

  const registries = await getConfiguredRegistries(packageFile);
  const registryUrls = registries
    ? registries.map((registry) => registry.url)
    : undefined;

  if (packageFile.endsWith('dotnet-tools.json')) {
    const deps: PackageDependency[] = [];
    let manifest: DotnetToolsManifest;

    try {
      manifest = JSON.parse(content);
    } catch (err) {
      logger.debug({ packageFile }, `Invalid JSON`);
      return null;
    }

    if (manifest.version !== 1) {
      logger.debug({ packageFile }, 'Unsupported dotnet tools version');
      return null;
    }

    for (const depName of Object.keys(manifest.tools ?? {})) {
      const tool = manifest.tools[depName];
      const currentValue = tool.version;
      const dep: PackageDependency = {
        depType: 'nuget',
        depName,
        currentValue,
        datasource: NugetDatasource.id,
      };
      if (registryUrls) {
        dep.registryUrls = registryUrls;
      }

      deps.push(dep);
    }

    return deps.length ? { deps } : null;
  }

  if (packageFile.endsWith('global.json')) {
    return extractMsbuildGlobalManifest(content, packageFile);
  }

  let deps: PackageDependency[] = [];
  let packageFileVersion: string | undefined;
  try {
    const parsedXml = new XmlDocument(content);
    deps = extractDepsFromXml(parsedXml).map((dep) => ({
      ...dep,
      ...(registryUrls && { registryUrls }),
    }));
    packageFileVersion = findVersion(parsedXml)?.val;
  } catch (err) {
    logger.debug({ err, packageFile }, `Failed to parse XML`);
  }

  if (!deps.length) {
    return null;
  }

  const res: PackageFileContent = { deps, packageFileVersion };
  const lockFileName = getSiblingFileName(packageFile, 'packages.lock.json');
  // istanbul ignore if
  if (await localPathExists(lockFileName)) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
