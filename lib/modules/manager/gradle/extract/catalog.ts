import is from '@sindresorhus/is';
import deepmerge from 'deepmerge';
import type { SkipReason } from '../../../../types';
import { hasKey } from '../../../../util/object';
import { escapeRegExp, regEx } from '../../../../util/regex';
import { parse as parseToml } from '../../../../util/toml';
import type { PackageDependency } from '../../types';
import type {
  GradleCatalog,
  GradleCatalogArtifactDescriptor,
  GradleCatalogModuleDescriptor,
  GradleManagerData,
  GradleVersionCatalogVersion,
  GradleVersionPointerTarget,
  VersionPointer,
} from '../types';

function findVersionIndex(
  content: string,
  depName: string,
  version: string,
): number {
  const eDn = escapeRegExp(depName);
  const eVer = escapeRegExp(version);
  const re = regEx(
    `(?:id\\s*=\\s*)?['"]?${eDn}["']?(?:(?:\\s*=\\s*)|:|,\\s*)(?:.*version(?:\\.ref)?(?:\\s*\\=\\s*))?["']?${eVer}['"]?`,
  );
  const match = re.exec(content);
  if (match) {
    return match.index + content.slice(match.index).indexOf(version);
  }
  // ignoring Fallback because I can't reach it in tests, and code is not supposed to reach it but just in case.
  /* istanbul ignore next */
  return findIndexAfter(content, depName, version);
}

function findIndexAfter(
  content: string,
  sliceAfter: string,
  find: string,
): number {
  const slicePoint = content.indexOf(sliceAfter) + sliceAfter.length;
  return slicePoint + content.slice(slicePoint).indexOf(find);
}

function isArtifactDescriptor(
  obj: GradleCatalogArtifactDescriptor | GradleCatalogModuleDescriptor,
): obj is GradleCatalogArtifactDescriptor {
  return hasKey('group', obj);
}

function isVersionPointer(
  obj: GradleVersionCatalogVersion | undefined,
): obj is VersionPointer {
  return hasKey('ref', obj);
}

function normalizeAlias(alias: string): string {
  return alias.replace(regEx(/[-_]/g), '.');
}

function findOriginalAlias(
  versions: Record<string, GradleVersionPointerTarget>,
  alias: string,
): string {
  const normalizedAlias = normalizeAlias(alias);
  for (const sectionKey of Object.keys(versions)) {
    if (normalizeAlias(sectionKey) === normalizedAlias) {
      return sectionKey;
    }
  }

  return alias;
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
  version: GradleVersionCatalogVersion | undefined;
  versions: Record<string, GradleVersionPointerTarget>;
  depStartIndex: number;
  depSubContent: string;
  depName: string;
  versionStartIndex: number;
  versionSubContent: string;
}): VersionExtract {
  if (isVersionPointer(version)) {
    const originalAlias = findOriginalAlias(versions, version.ref);
    return extractLiteralVersion({
      version: versions[originalAlias],
      depStartIndex: versionStartIndex,
      depSubContent: versionSubContent,
      sectionKey: originalAlias,
    });
  } else {
    return extractLiteralVersion({
      version,
      depStartIndex,
      depSubContent,
      sectionKey: depName,
    });
  }
}

function extractLiteralVersion({
  version,
  depStartIndex,
  depSubContent,
  sectionKey,
}: {
  version: GradleVersionPointerTarget | undefined;
  depStartIndex: number;
  depSubContent: string;
  sectionKey: string;
}): VersionExtract {
  if (!version) {
    return { skipReason: 'unspecified-version' };
  } else if (is.string(version)) {
    const fileReplacePosition =
      depStartIndex + findVersionIndex(depSubContent, sectionKey, version);
    return { currentValue: version, fileReplacePosition };
  } else if (is.plainObject(version)) {
    // https://github.com/gradle/gradle/blob/d9adf33a57925582988fc512002dcc0e8ce4db95/subprojects/core/src/main/java/org/gradle/api/internal/catalog/parser/TomlCatalogFileParser.java#L368
    // https://docs.gradle.org/current/userguide/rich_versions.html
    // https://docs.gradle.org/current/userguide/platforms.html#sub::toml-dependencies-format
    const versionKeys = ['require', 'prefer', 'strictly'];
    let found = false;
    let currentValue: string | undefined;
    let fileReplacePosition: number | undefined;

    if (version.reject || version.rejectAll) {
      return { skipReason: 'unsupported-version' };
    }

    for (const key of versionKeys) {
      if (key in version) {
        if (found) {
          // Currently, we only support one version constraint at a time
          return { skipReason: 'multiple-constraint-dep' };
        }
        found = true;

        currentValue = version[key] as string;
        fileReplacePosition =
          depStartIndex +
          findIndexAfter(depSubContent, sectionKey, currentValue);
      }
    }

    if (found) {
      return { currentValue, fileReplacePosition };
    }
  }

  return { skipReason: 'unspecified-version' };
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
  versions: Record<string, GradleVersionPointerTarget>;
  depStartIndex: number;
  depSubContent: string;
  depName: string;
  versionStartIndex: number;
  versionSubContent: string;
}): PackageDependency<GradleManagerData> {
  if (is.string(descriptor)) {
    const [groupName, name, currentValue] = descriptor.split(':');
    if (!currentValue) {
      return {
        depName,
        skipReason: 'unspecified-version',
      };
    }
    return {
      depName: `${groupName}:${name}`,
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
      skipReason,
    };
  }

  const dependency: PackageDependency<GradleManagerData> = {
    currentValue,
    managerData: { fileReplacePosition },
  };

  if (isArtifactDescriptor(descriptor)) {
    const { group, name } = descriptor;
    dependency.depName = `${group}:${name}`;
  } else {
    const [depGroupName, name] = descriptor.module.split(':');
    dependency.depName = `${depGroupName}:${name}`;
  }

  if (isVersionPointer(descriptor.version)) {
    dependency.groupName = normalizeAlias(descriptor.version.ref);
  }

  return dependency;
}

export function parseCatalog(
  packageFile: string,
  content: string,
): PackageDependency<GradleManagerData>[] {
  const tomlContent = parseToml(content) as GradleCatalog;
  const versions = tomlContent.versions ?? {};
  const libs = tomlContent.libraries ?? {};
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

  const plugins = tomlContent.plugins ?? {};
  const pluginsStartIndex = content.indexOf('[plugins]');
  const pluginsSubContent = content.slice(pluginsStartIndex);
  for (const pluginName of Object.keys(plugins)) {
    const pluginDescriptor = plugins[pluginName];
    const [depName, version] = is.string(pluginDescriptor)
      ? pluginDescriptor.split(':')
      : [pluginDescriptor.id, pluginDescriptor.version];
    const { currentValue, fileReplacePosition, skipReason } = extractVersion({
      version,
      versions,
      depStartIndex: pluginsStartIndex,
      depSubContent: pluginsSubContent,
      depName,
      versionStartIndex,
      versionSubContent,
    });

    const dependency: PackageDependency<GradleManagerData> = {
      depType: 'plugin',
      depName,
      packageName: `${depName}:${depName}.gradle.plugin`,
      currentValue,
      commitMessageTopic: `plugin ${pluginName}`,
      managerData: { fileReplacePosition },
    };
    if (skipReason) {
      dependency.skipReason = skipReason;
    }
    if (isVersionPointer(version) && dependency.commitMessageTopic) {
      dependency.groupName = normalizeAlias(version.ref);
      delete dependency.commitMessageTopic;
    }

    extractedDeps.push(dependency);
  }

  const deps = extractedDeps.map((dep) => {
    return deepmerge(dep, { managerData: { packageFile } });
  });
  return deps;
}
