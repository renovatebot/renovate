import { parse } from '@iarna/toml';
import deepmerge from 'deepmerge';
import type { SkipReason } from '../../../../types';
import { hasKey } from '../../../../util/object';
import type { PackageDependency } from '../../types';
import type {
  GradleCatalog,
  GradleCatalogArtifactDescriptor,
  GradleCatalogModuleDescriptor,
  GradleManagerData,
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
  skipReason?: SkipReason;
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
    return { skipReason: 'no-version' };
  } else if (typeof version === 'string') {
    const fileReplacePosition =
      depStartIndex + findIndexAfter(depSubContent, depName, version);
    return { currentValue: version, fileReplacePosition };
  } else if (typeof version === 'object') {
    if (version.ref) {
      // everything else is ignored
      const currentValue = versions[version.ref];
      const fileReplacePosition =
        versionStartIndex +
        findIndexAfter(versionSubContent, version.ref, currentValue);
      return { currentValue, fileReplacePosition };
    }

    // https://github.com/gradle/gradle/blob/d9adf33a57925582988fc512002dcc0e8ce4db95/subprojects/core/src/main/java/org/gradle/api/internal/catalog/parser/TomlCatalogFileParser.java#L368
    // https://docs.gradle.org/current/userguide/rich_versions.html
    const versionKeys = ['require', 'prefer', 'strictly'];
    let found = false;
    let currentValue;
    let fileReplacePosition;

    for (const key of versionKeys) {
      if (key in version) {
        if (found) {
          // Currently, we only support one version constraint at a time
          return { skipReason: 'multiple-constraint-dep' };
        }
        found = true;

        currentValue = version[key];
        fileReplacePosition =
          depStartIndex +
          findIndexAfter(depSubContent, version[key], currentValue);
      }
    }

    if (found) {
      return { currentValue, fileReplacePosition };
    }
  }

  return { skipReason: 'unknown-version' };
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
        skipReason: 'no-version',
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

  const { currentValue, fileReplacePosition, skipReason } = extractVersion({
    version: descriptor.version,
    versions,
    depStartIndex,
    depSubContent,
    depName,
    versionStartIndex,
    versionSubContent,
  });

  if (skipReason) {
    return {
      depName,
      skipReason: skipReason,
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
      packageName: `${depName}:${depName}.gradle.plugin`,
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
