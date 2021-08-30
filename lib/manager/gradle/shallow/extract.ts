import { parse } from '@iarna/toml';
import * as upath from 'upath';
import {
  id as datasource,
  defaultRegistryUrls,
} from '../../../datasource/maven';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
} from '../../types';
import type { GradleManagerData } from '../types';
import { parseGradle, parseProps } from './parser';
import type {
  GradleCatalog,
  GradleCatalogPluginDescriptor,
  PackageVariables,
  VariableRegistry,
} from './types';
import {
  getVars,
  isGradleFile,
  isPropsFile,
  isTOMLFile,
  reorderFiles,
  toAbsolutePath,
} from './utils';

// Enables reverse sorting in generateBranchConfig()
//
// Required for grouped dependencies to be upgraded
// correctly in single branch.
//
// https://github.com/renovatebot/renovate/issues/8224
function elevateFileReplacePositionField(
  deps: PackageDependency<GradleManagerData>[]
): PackageDependency<GradleManagerData>[] {
  return deps.map((dep) => ({
    ...dep,
    fileReplacePosition: dep?.managerData?.fileReplacePosition,
  }));
}

function findIndexAfter(
  content: string,
  sliceAfter: string,
  find: string
): number {
  const slicePoint = content.indexOf(sliceAfter) + sliceAfter.length;
  return slicePoint + content.slice(slicePoint).indexOf(find);
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const extractedDeps: PackageDependency<GradleManagerData>[] = [];
  const registry: VariableRegistry = {};
  const packageFilesByName: Record<string, PackageFile> = {};
  const registryUrls = [];
  for (const packageFile of reorderFiles(packageFiles)) {
    packageFilesByName[packageFile] = {
      packageFile,
      datasource,
      deps: [],
    };

    try {
      const content = await readLocalFile(packageFile, 'utf8');
      const dir = upath.dirname(toAbsolutePath(packageFile));

      const updateVars = (newVars: PackageVariables): void => {
        const oldVars = registry[dir] || {};
        registry[dir] = { ...oldVars, ...newVars };
      };

      if (isPropsFile(packageFile)) {
        const { vars, deps } = parseProps(content, packageFile);
        updateVars(vars);
        extractedDeps.push(...deps);
      } else if (isTOMLFile(packageFile)) {
        // Implement TOML file parsing and extraction
        const tomlContent = parse(content) as GradleCatalog;
        const versions = tomlContent.versions || {};
        const libs = tomlContent.libraries || {};
        const libStartIndex = content.indexOf('libraries');
        const libSubContent = content.slice(libStartIndex);
        const versionStartIndex = content.indexOf('versions');
        const versionSubContent = content.slice(versionStartIndex);
        for (const libraryName of Object.keys(libs)) {
          const libDescriptor = libs[libraryName];
          const group: string =
            typeof libDescriptor === 'string'
              ? libDescriptor.split(':')[0]
              : libDescriptor.group || libDescriptor.module?.split(':')[0];
          const name: string =
            typeof libDescriptor === 'string'
              ? libDescriptor.split(':')[1]
              : libDescriptor.name || libDescriptor.module?.split(':')[1];
          const version = libDescriptor.version || libDescriptor.split(':')[2];
          const currentVersion =
            typeof version === 'string' ? version : versions[version.ref];
          const fileReplacePosition =
            typeof version === 'string'
              ? libStartIndex +
                findIndexAfter(libSubContent, libraryName, currentVersion)
              : versionStartIndex +
                findIndexAfter(versionSubContent, version.ref, currentVersion);
          const dependency = {
            depName: `${group}:${name}`,
            groupName: group,
            currentValue: currentVersion,
            managerData: { fileReplacePosition, packageFile },
          };
          extractedDeps.push(dependency);
        }
        const plugins = tomlContent.plugins || {};
        const pluginsStartIndex = content.indexOf('[plugins]');
        const pluginsSubContent = content.slice(pluginsStartIndex);
        for (const pluginName of Object.keys(plugins)) {
          const pluginDescriptor = plugins[
            pluginName
          ] as GradleCatalogPluginDescriptor;
          const pluginId = pluginDescriptor.id;
          const version = pluginDescriptor.version;
          const currentVersion: string =
            typeof version === 'string' ? version : versions[version.ref];
          const fileReplacePosition =
            typeof version === 'string'
              ? pluginsStartIndex +
                findIndexAfter(pluginsSubContent, pluginId, currentVersion)
              : versionStartIndex +
                findIndexAfter(versionSubContent, version.ref, currentVersion);
          const dependency = {
            depType: 'plugin',
            depName: pluginId,
            lookupName: `${pluginId}:${pluginId}.gradle.plugin`,
            registryUrls: ['https://plugins.gradle.org/m2/'],
            currentValue: currentVersion,
            commitMessageTopic: `plugin ${pluginName}`,
            managerData: { fileReplacePosition, packageFile },
          };
          extractedDeps.push(dependency);
        }
      } else if (isGradleFile(packageFile)) {
        const vars = getVars(registry, dir);
        const {
          deps,
          urls,
          vars: gradleVars,
        } = parseGradle(content, vars, packageFile);
        urls.forEach((url) => {
          if (!registryUrls.includes(url)) {
            registryUrls.push(url);
          }
        });
        registry[dir] = { ...registry[dir], ...gradleVars };
        updateVars(gradleVars);
        extractedDeps.push(...deps);
      }
    } catch (e) {
      logger.warn(
        { config, packageFile },
        `Failed to process Gradle file: ${packageFile}`
      );
    }
  }

  if (!extractedDeps.length) {
    return null;
  }

  elevateFileReplacePositionField(extractedDeps).forEach((dep) => {
    const key = dep.managerData.packageFile;
    const pkgFile: PackageFile = packageFilesByName[key];
    const { deps } = pkgFile;
    deps.push({
      ...dep,
      registryUrls: [
        ...new Set([
          ...defaultRegistryUrls,
          ...(dep.registryUrls || []),
          ...registryUrls,
        ]),
      ],
    });
    packageFilesByName[key] = pkgFile;
  });

  return Object.values(packageFilesByName);
}
