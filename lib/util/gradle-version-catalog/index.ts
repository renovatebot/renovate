import { isPlainObject, isString } from '@sindresorhus/is';
import deepmerge from 'deepmerge';
import { type AST, getStaticTOMLValue } from 'toml-eslint-parser';
import type { PackageDependency } from '../../modules/manager/types.ts';
import type { SkipReason } from '../../types/index.ts';
import { coerceObject, hasKey } from '../object.ts';
import { regEx } from '../regex.ts';
import { massageWithSourceMap, parseTOMLDocument } from '../toml.ts';
import type {
  GradleCatalog,
  GradleCatalogArtifactDescriptor,
  GradleCatalogModuleDescriptor,
  GradleVersionCatalogVersion,
  GradleVersionPointerTarget,
  VersionCatalogManagerData,
  VersionCatalogVariables,
  VersionPointer,
} from './types.ts';

interface CatalogContext {
  versions: Record<string, GradleVersionPointerTarget>;
  getPosition: (path: string[], version: string) => number | undefined;
}

function collectStringNodes(
  entries: (AST.TOMLKeyValue | AST.TOMLTable)[],
  path: string[],
  nodes: Map<string, AST.TOMLStringValue>,
): void {
  for (const entry of entries) {
    if (entry.type === 'TOMLTable') {
      collectStringNodes(entry.body, entry.resolvedKey.map(String), nodes);
    } else {
      const key = [...path, ...getStaticTOMLValue(entry.key)];
      const { value } = entry;
      if (value.type === 'TOMLInlineTable') {
        collectStringNodes(value.body, key, nodes);
      } else if (value.type === 'TOMLValue' && value.kind === 'string') {
        nodes.set(JSON.stringify(key), value);
      }
    }
  }
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

function extractVersion(
  version: GradleVersionCatalogVersion | undefined,
  path: string[],
  context: CatalogContext,
): VersionExtract {
  if (isVersionPointer(version)) {
    const originalAlias = findOriginalAlias(context.versions, version.ref);
    return extractLiteralVersion(
      context.versions[originalAlias],
      ['versions', originalAlias],
      context,
    );
  }
  return extractLiteralVersion(version, path, context);
}

function extractLiteralVersion(
  version: GradleVersionPointerTarget | undefined,
  path: string[],
  context: CatalogContext,
): VersionExtract {
  if (!version) {
    return { skipReason: 'unspecified-version' };
  }
  if (isString(version)) {
    const fileReplacePosition = context.getPosition(path, version);
    if (fileReplacePosition === undefined) {
      return { skipReason: 'unsupported-version' };
    }
    return { currentValue: version, fileReplacePosition };
  }
  // v8 ignore else -- a version is either a string, handled above, or a table
  if (isPlainObject(version)) {
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
        fileReplacePosition = context.getPosition([...path, key], currentValue);
      }
    }

    if (found) {
      if (fileReplacePosition === undefined) {
        return { skipReason: 'unsupported-version' };
      }
      return { currentValue, fileReplacePosition };
    }
  }

  return { skipReason: 'unspecified-version' };
}

function extractDependency({
  descriptor,
  depName,
  context,
}: {
  descriptor:
    string | GradleCatalogModuleDescriptor | GradleCatalogArtifactDescriptor;
  depName: string;
  context: CatalogContext;
}): PackageDependency<VersionCatalogManagerData> {
  if (isString(descriptor)) {
    const [group, name, currentValue] = descriptor.split(':');
    if (!currentValue) {
      return {
        depName,
        skipReason: 'unspecified-version',
      };
    }
    const { fileReplacePosition, ...extracted } = extractLiteralVersion(
      currentValue,
      ['libraries', depName],
      context,
    );
    return {
      depName: `${group}:${name}`,
      ...extracted,
      managerData: { fileReplacePosition },
    };
  }

  const { currentValue, fileReplacePosition, skipReason } = extractVersion(
    descriptor.version,
    ['libraries', depName, 'version'],
    context,
  );

  if (skipReason) {
    return {
      depName,
      skipReason,
    };
  }

  const dependency: PackageDependency<VersionCatalogManagerData> = {
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
    dependency.sharedVariableName = normalizeAlias(descriptor.version.ref);
  }

  return dependency;
}

export function parseCatalog(
  packageFile: string,
  content: string,
): {
  vars: VersionCatalogVariables;
  deps: PackageDependency<VersionCatalogManagerData>[];
} {
  const { content: massaged, toOriginalOffset } = massageWithSourceMap(content);
  const document = parseTOMLDocument(massaged);
  const tomlContent = getStaticTOMLValue(document) as GradleCatalog;
  const nodes = new Map<string, AST.TOMLStringValue>();
  collectStringNodes(document.body[0].body, [], nodes);
  const versions = coerceObject(tomlContent.versions);
  const libs = coerceObject(tomlContent.libraries);
  const context: CatalogContext = {
    versions,
    getPosition(path, version) {
      const node = nodes.get(JSON.stringify(path));
      if (!node) {
        return undefined;
      }
      const closingQuotes = node.multiline ? 3 : 1;
      const rawValue = massaged.slice(
        node.range[0] + closingQuotes,
        node.range[1] - closingQuotes,
      );
      const literalValue = node.multiline
        ? rawValue.replace(regEx(/^\r?\n/), '')
        : rawValue;
      if (literalValue !== node.value || !node.value.endsWith(version)) {
        return undefined;
      }
      const offset = toOriginalOffset(
        node.range[1] - closingQuotes - version.length,
      );
      if (content.slice(offset, offset + version.length) !== version) {
        return undefined;
      }
      return offset;
    },
  };
  const extractedDeps: PackageDependency<VersionCatalogManagerData>[] = [];
  const vars: VersionCatalogVariables = {};

  for (const [key, version] of Object.entries(versions)) {
    const { currentValue, fileReplacePosition } = extractLiteralVersion(
      version,
      ['versions', key],
      context,
    );
    if (currentValue && fileReplacePosition !== undefined) {
      vars[normalizeAlias(key)] = {
        key: normalizeAlias(key),
        value: currentValue,
        fileReplacePosition,
        packageFile,
      };
    }
  }

  for (const libraryName of Object.keys(libs)) {
    const libDescriptor = libs[libraryName];
    const dependency = extractDependency({
      descriptor: libDescriptor,
      depName: libraryName,
      context,
    });
    extractedDeps.push(dependency);
  }

  const plugins = coerceObject(tomlContent.plugins);
  for (const pluginName of Object.keys(plugins)) {
    const pluginDescriptor = plugins[pluginName];
    const [depName, version] = isString(pluginDescriptor)
      ? pluginDescriptor.split(':')
      : [pluginDescriptor.id, pluginDescriptor.version];
    const path = ['plugins', pluginName];
    if (!isString(pluginDescriptor)) {
      path.push('version');
    }
    const { currentValue, fileReplacePosition, skipReason } = extractVersion(
      version,
      path,
      context,
    );

    const dependency: PackageDependency<VersionCatalogManagerData> = {
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
      dependency.sharedVariableName = normalizeAlias(version.ref);
      delete dependency.commitMessageTopic;
    }

    extractedDeps.push(dependency);
  }

  const deps = extractedDeps.map((dep) => {
    return deepmerge(dep, { managerData: { packageFile } });
  });
  return { vars, deps };
}
