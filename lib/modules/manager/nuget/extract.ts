import is from '@sindresorhus/is';
import type { XmlElement } from 'xmldoc';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { getSiblingFileName, localPathExists } from '../../../util/fs';
import { NugetDatasource } from '../../datasource/nuget';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { extractMsbuildGlobalManifest } from './extract/global-manifest';
import type { DotnetToolsManifest, NugetPackageDependency } from './types';
import {
  applyRegistries,
  findVersion,
  getConfiguredRegistries,
  isXmlElement,
} from './util';

/**
 * https://docs.microsoft.com/en-us/nuget/concepts/package-versioning
 * This article mentions that  Nuget 3.x and later tries to restore the lowest possible version
 * regarding to given version range.
 * 1.3.4 equals [1.3.4,)
 */
const elemNames = new Set([
  'PackageReference',
  'PackageVersion',
  'DotNetCliToolReference',
  'GlobalPackageReference',
]);

function extractDepsFromXml(xmlNode: XmlDocument): NugetPackageDependency[] {
  const results: NugetPackageDependency[] = [];
  const vars = new Map<string, string>();
  const todo: XmlElement[] = [xmlNode];
  while (todo.length) {
    const child = todo.pop()!;
    const { name, attr } = child;

    if (name === 'ContainerBaseImage') {
      const { depName, ...dep } = getDep(child.val, true);

      if (is.nonEmptyStringAndNotWhitespace(depName)) {
        results.push({ ...dep, depName, depType: 'docker' });
      }
    } else if (elemNames.has(name)) {
      const depName = attr?.Include || attr?.Update;

      if (!depName) {
        continue;
      }

      const dep: NugetPackageDependency = {
        datasource: NugetDatasource.id,
        depType: 'nuget',
        depName,
      };

      let currentValue: string | undefined =
        attr?.Version ??
        attr?.version ??
        child.valueWithPath('Version') ??
        attr?.VersionOverride ??
        child.valueWithPath('VersionOverride');

      if (!is.nonEmptyStringAndNotWhitespace(currentValue)) {
        dep.skipReason = 'invalid-version';
      }

      let sharedVariableName: string | undefined;

      currentValue = currentValue
        ?.trim()
        ?.replace(/^\$\((\w+)\)$/, (match, key) => {
          sharedVariableName = key;
          const val = vars.get(key);
          if (val) {
            return val;
          }
          return match;
        });

      if (sharedVariableName) {
        if (currentValue === `$(${sharedVariableName})`) {
          // this means that be failed to find/replace the variable
          dep.skipReason = 'contains-variable';
        } else {
          dep.sharedVariableName = sharedVariableName;
        }
      }

      dep.currentValue = currentValue;
      results.push(dep);
    } else if (name === 'Sdk') {
      const depName = attr?.Name;
      const version = attr?.Version;
      // if sdk element is present it will always have the Name field but the Version is an optional field
      if (depName && version) {
        results.push({
          depName,
          currentValue: version,
          depType: 'msbuild-sdk',
          datasource: NugetDatasource.id,
        });
      }
    } else if (name === 'Import') {
      const depName = attr?.Sdk;
      const version = attr?.Version;
      if (depName && version) {
        results.push({
          depName,
          currentValue: version,
          depType: 'msbuild-sdk',
          datasource: NugetDatasource.id,
        });
      }
    } else {
      if (name === 'Project') {
        if (attr?.Sdk) {
          const str = attr?.Sdk;
          const [name, version] = str.split('/');
          if (name && version) {
            results.push({
              depName: name,
              depType: 'msbuild-sdk',
              currentValue: version,
              datasource: NugetDatasource.id,
            });
          }
        }

        const propertyGroup = child.childNamed('PropertyGroup');
        if (propertyGroup) {
          for (const propChild of propertyGroup.children) {
            if (isXmlElement(propChild)) {
              const { name, val } = propChild;
              if (!['Version', 'TargetFramework'].includes(name)) {
                vars.set(name, val);
              }
            }
          }
        }
      }

      todo.push(...child.children.filter(isXmlElement));
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

  if (packageFile.endsWith('dotnet-tools.json')) {
    const deps: PackageDependency[] = [];
    let manifest: DotnetToolsManifest;

    try {
      manifest = JSON.parse(content);
    } catch {
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
      const dep: NugetPackageDependency = {
        depType: 'nuget',
        depName,
        currentValue,
        datasource: NugetDatasource.id,
      };

      applyRegistries(dep, registries);

      deps.push(dep);
    }

    return deps.length ? { deps } : null;
  }

  if (packageFile.endsWith('global.json')) {
    return extractMsbuildGlobalManifest(content, packageFile, registries);
  }

  let deps: PackageDependency[] = [];
  let packageFileVersion: string | undefined;
  try {
    const parsedXml = new XmlDocument(content);
    deps = extractDepsFromXml(parsedXml).map((dep) =>
      applyRegistries(dep, registries),
    );
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
