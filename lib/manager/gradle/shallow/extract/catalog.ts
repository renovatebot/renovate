import { parse } from '@iarna/toml';
import { PackageDependency } from '../../../types';
import { GradleManagerData } from '../../types';
import type { GradleCatalog, GradleCatalogPluginDescriptor } from '../types';

function findIndexAfter(
  content: string,
  sliceAfter: string,
  find: string
): number {
  const slicePoint = content.indexOf(sliceAfter) + sliceAfter.length;
  return slicePoint + content.slice(slicePoint).indexOf(find);
}

export function parseCatalog(
  packageFile: string,
  content: string
): PackageDependency<GradleManagerData>[] {
  const tomlContent = parse(content) as GradleCatalog;
  const versions = tomlContent.versions || {};
  const libs = tomlContent.libraries || {};
  const libStartIndex = content.indexOf('libraries');
  const libSubContent = content.slice(libStartIndex);
  const versionStartIndex = content.indexOf('versions');
  const versionSubContent = content.slice(versionStartIndex);
  const extractedDeps: PackageDependency<GradleManagerData>[] = [];
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
  return extractedDeps;
}
