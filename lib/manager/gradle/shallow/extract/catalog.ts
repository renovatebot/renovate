import { parse } from '@iarna/toml';
import deepmerge from 'deepmerge';
import { SkipReason } from '../../../../types';
import { hasKey } from '../../../../util/object';
import type { PackageDependency } from '../../../types';
import type { GradleManagerData } from '../../types';
import type {
  GradleCatalog,
  GradleCatalogArtifactDescriptor,
  GradleCatalogModuleDescriptor,
  VersionPointer,
} from '../types';

function findIndexAfter(
  content: string,
  sliceAfter: string,
  find: string
): number {
  const slicePoint = content.indexOf(sliceAfter) + sliceAfter.length;
  return slicePoint + content.slice(slicePoint).indexOf(find);
}

function isArtifactDescriptor(
  obj: GradleCatalogArtifactDescriptor | GradleCatalogModuleDescriptor
): obj is GradleCatalogArtifactDescriptor {
  return hasKey('group', obj);
}

interface VersionExtract {
  currentValue?: string;
  fileReplacePosition?: number;
}

function extractVersion({
  version,
  versions,
  depStartIndex,
  depSubContent,
  depName,
  versionStartIndex,
  versionSubContent,
}: {
  version: string | VersionPointer;
  versions: Record<string, string>;
  depStartIndex: number;
  depSubContent: string;
  depName: string;
  versionStartIndex: number;
  versionSubContent: string;
}): VersionExtract {
  if (!version) {
    return {};
  }
  const currentValue =
    typeof version === 'string' ? version : versions[version.ref];

  const fileReplacePosition =
    typeof version === 'string'
      ? depStartIndex + findIndexAfter(depSubContent, depName, currentValue)
      : versionStartIndex +
        findIndexAfter(versionSubContent, version.ref, currentValue);
  return { currentValue, fileReplacePosition };
}

function extractDependency({
  descriptor,
  versions,
  depStartIndex,
  depSubContent,
  depName,
  versionStartIndex,
  versionSubContent,
}: {
  descriptor:
    | string
    | GradleCatalogModuleDescriptor
    | GradleCatalogArtifactDescriptor;
  versions: Record<string, string>;
  depStartIndex: number;
  depSubContent: string;
  depName: string;
  versionStartIndex: number;
  versionSubContent: string;
}): PackageDependency<GradleManagerData> {
  if (typeof descriptor === 'string') {
    const [groupName, name, currentValue] = descriptor.split(':');
    if (!currentValue) {
      return {
        depName,
        skipReason: SkipReason.NoVersion,
      };
    }
    return {
      depName: `${groupName}:${name}`,
      groupName,
      currentValue,
      managerData: {
        fileReplacePosition:
          depStartIndex + findIndexAfter(depSubContent, depName, currentValue),
      },
    };
  }

  const { currentValue, fileReplacePosition } = extractVersion({
    version: descriptor.version,
    versions,
    depStartIndex,
    depSubContent,
    depName,
    versionStartIndex,
    versionSubContent,
  });

  if (!currentValue) {
    return {
      depName,
      skipReason: SkipReason.NoVersion,
    };
  }

  if (isArtifactDescriptor(descriptor)) {
    const { group: groupName, name } = descriptor;
    return {
      depName: `${groupName}:${name}`,
      groupName,
      currentValue,
      managerData: { fileReplacePosition },
    };
  }
  const [groupName, name] = descriptor.module.split(':');
  const dependency = {
    depName: `${groupName}:${name}`,
    groupName,
    currentValue,
    managerData: { fileReplacePosition },
  };
  return dependency;
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
    const dependency = extractDependency({
      descriptor: libDescriptor,
      versions,
      depStartIndex: libStartIndex,
      depSubContent: libSubContent,
      depName: libraryName,
      versionStartIndex,
      versionSubContent,
    });
    extractedDeps.push(dependency);
  }

  const plugins = tomlContent.plugins || {};
  const pluginsStartIndex = content.indexOf('[plugins]');
  const pluginsSubContent = content.slice(pluginsStartIndex);
  for (const pluginName of Object.keys(plugins)) {
    const pluginDescriptor = plugins[pluginName];
    const [depName, version] =
      typeof pluginDescriptor === 'string'
        ? pluginDescriptor.split(':')
        : [pluginDescriptor.id, pluginDescriptor.version];
    const { currentValue, fileReplacePosition } = extractVersion({
      version,
      versions,
      depStartIndex: pluginsStartIndex,
      depSubContent: pluginsSubContent,
      depName,
      versionStartIndex,
      versionSubContent,
    });

    const dependency = {
      depType: 'plugin',
      depName,
      lookupName: `${depName}:${depName}.gradle.plugin`,
      registryUrls: ['https://plugins.gradle.org/m2/'],
      currentValue,
      commitMessageTopic: `plugin ${pluginName}`,
      managerData: { fileReplacePosition },
    };
    extractedDeps.push(dependency);
  }
  return extractedDeps.map((dep) =>
    deepmerge(dep, { managerData: { packageFile } })
  );
}
