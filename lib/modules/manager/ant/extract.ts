import upath from 'upath';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';

const scopeNames = new Set([
  'compile',
  'runtime',
  'test',
  'provided',
  'system',
]);

interface AntProperty {
  value: string;
  fileReplacePosition: number;
  packageFile: string;
}

interface WalkContext {
  propertyMap: Map<string, AntProperty>;
  visitedXmlFiles: Set<string>;
  visitedPropertiesFiles: Set<string>;
  results: Map<string, PackageFileContent>;
}

function isXmlElement(node: unknown): node is XmlDocument {
  const n = node as { type?: string };
  return n?.type === 'element';
}

function escapeRegex(input: string): string {
  return input.replace(regEx(/[.*+?^${}()|[\]\\]/g), '\\$&');
}

function readAttributeRange(
  content: string,
  node: XmlDocument,
  attrName: string,
  attrValue: string,
): { valuePosition: number; valueLength: number } | null {
  const startTagPosition = node.startTagPosition ?? node.position;
  /* v8 ignore next 3 -- xmldoc always sets startTagPosition */
  if (startTagPosition === undefined || startTagPosition === null) {
    return null;
  }

  const tagEnd = content.indexOf('>', startTagPosition);
  /* v8 ignore next 3 -- parsed XML always contains closing > */
  if (tagEnd === -1) {
    return null;
  }

  const tagContent = content.slice(startTagPosition, tagEnd + 1);
  const attrRegex = regEx(
    `\\b${attrName}\\s*=\\s*(?<quote>["'])(?<value>${escapeRegex(attrValue)})\\k<quote>`,
  );
  const match = attrRegex.exec(tagContent);
  /* v8 ignore next 3 -- only called with attributes already parsed by xmldoc */
  if (!match?.groups?.quote || !match.groups.value) {
    return null;
  }

  const valuePosition =
    startTagPosition + match.index + match[0].indexOf(match.groups.value);
  return { valuePosition, valueLength: match.groups.value.length };
}

function addProperty(
  ctx: WalkContext,
  name: string,
  value: string,
  fileReplacePosition: number,
  packageFile: string,
): void {
  if (!ctx.propertyMap.has(name)) {
    ctx.propertyMap.set(name, { value, fileReplacePosition, packageFile });
  }
}

function parsePropertiesFile(
  content: string,
  packageFile: string,
  ctx: WalkContext,
): void {
  const isCrlf = content.includes('\r\n');
  const lineBreakLength = isCrlf ? 2 : 1;
  const lines = content.split(regEx(/\r?\n/));

  let offset = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
      offset += line.length + lineBreakLength;
      continue;
    }

    const separatorMatch = regEx(/[:=]/).exec(trimmed);
    if (!separatorMatch?.index) {
      offset += line.length + lineBreakLength;
      continue;
    }

    const separatorIndex = separatorMatch.index;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1);
    const leftPartLength = separatorIndex + 1 + rawValue.search(regEx(/\S|$/));
    const value = rawValue.trim();

    if (!key || !value) {
      offset += line.length + lineBreakLength;
      continue;
    }

    const leadingWhitespace = line.length - line.trimStart().length;
    const valuePosition = offset + leadingWhitespace + leftPartLength;

    addProperty(ctx, key, value, valuePosition, packageFile);
    offset += line.length + lineBreakLength;
  }
}

function resolvePropertyString(
  input: string,
  propertyMap: Map<string, AntProperty>,
  visited: Set<string> = new Set(),
): string | null {
  if (!input.includes('${')) {
    return input;
  }

  const propRegex = regEx(/\$\{([^}]+)}/g);
  let changed = false;
  const result = input.replace(propRegex, (match, propName: string) => {
    if (visited.has(propName)) {
      return match;
    }

    const prop = propertyMap.get(propName);
    if (!prop) {
      return match;
    }

    visited.add(propName);
    const resolved = resolvePropertyString(prop.value, propertyMap, visited);
    visited.delete(propName);

    if (!resolved) {
      return match;
    }

    /* v8 ignore next 3 -- v8 does not track replace callback coverage reliably */
    changed = true;
    return resolved;
  });

  if (changed && result.includes('${')) {
    return null;
  }

  if (!changed) {
    return null;
  }

  return result;
}

function resolveVersionReference(
  rawVersion: string,
  propertyMap: Map<string, AntProperty>,
): {
  currentValue: string | null;
  sharedVariableName: string | undefined;
  property: AntProperty | undefined;
} {
  const singlePropMatch = regEx(/^\$\{([^}]+)}$/).exec(rawVersion);

  if (singlePropMatch) {
    const propName = singlePropMatch[1];
    const prop = propertyMap.get(propName);
    if (!prop) {
      return {
        currentValue: null,
        sharedVariableName: propName,
        property: undefined,
      };
    }

    const resolved = resolvePropertyString(
      prop.value,
      propertyMap,
      new Set([propName]),
    );
    return {
      currentValue: resolved,
      sharedVariableName: propName,
      property: prop,
    };
  }

  if (rawVersion.includes('${')) {
    const resolved = resolvePropertyString(rawVersion, propertyMap);
    return {
      currentValue: resolved,
      sharedVariableName: undefined,
      property: undefined,
    };
  }

  return {
    currentValue: rawVersion,
    sharedVariableName: undefined,
    property: undefined,
  };
}

function parseCoords(coords: string): {
  depName: string;
  depType?: string;
  rawVersion: string;
} | null {
  const parts = coords.split(':');
  if (parts.length < 3) {
    return null;
  }

  const [groupId, artifactId] = parts;
  if (!groupId || !artifactId) {
    return null;
  }

  let depType: string | undefined;
  let rawVersion: string;

  if (parts.length >= 4 && scopeNames.has(parts.at(-1)!)) {
    depType = parts.at(-1);
    rawVersion = parts.at(-2)!;
  } else {
    rawVersion = parts.at(-1)!;
  }

  return {
    depName: `${groupId}:${artifactId}`,
    rawVersion,
    depType,
  };
}

function getDependencyType(
  scope: string | undefined,
  coordsDepType?: string,
): string {
  if (coordsDepType) {
    return coordsDepType;
  }
  if (scope && scopeNames.has(scope)) {
    return scope;
  }
  return 'compile';
}

function addDependencyResult(
  dep: PackageDependency,
  targetFile: string,
  ctx: WalkContext,
): void {
  if (!ctx.results.has(targetFile)) {
    ctx.results.set(targetFile, { packageFile: targetFile, deps: [] });
  }
  ctx.results.get(targetFile)!.deps.push(dep);
}

function collectDependency(
  content: string,
  node: XmlDocument,
  packageFile: string,
  ctx: WalkContext,
): void {
  if (node.attr.groupId && node.attr.artifactId && node.attr.version) {
    collectInlineDependency(content, node, packageFile, ctx);
  } else if (node.attr.coords) {
    collectCoordsDependency(content, node, packageFile, ctx);
  }
}

function collectInlineDependency(
  content: string,
  node: XmlDocument,
  packageFile: string,
  ctx: WalkContext,
): void {
  const { groupId, artifactId, version, scope } = node.attr;

  const range = readAttributeRange(content, node, 'version', version);
  /* v8 ignore next 3 -- readAttributeRange only fails if xmldoc misreports attributes */
  if (!range) {
    return;
  }

  const { currentValue, sharedVariableName, property } =
    resolveVersionReference(version, ctx.propertyMap);

  const dep: PackageDependency = {
    datasource: MavenDatasource.id,
    depName: `${groupId}:${artifactId}`,
    depType: getDependencyType(scope),
    registryUrls: [],
  };

  if (currentValue) {
    dep.currentValue = currentValue;
  } else {
    dep.currentValue = version;
    dep.skipReason = 'contains-variable';
  }

  if (sharedVariableName) {
    dep.sharedVariableName = sharedVariableName;
  }

  const targetFile = property?.packageFile ?? packageFile;
  dep.fileReplacePosition =
    property?.fileReplacePosition ?? range.valuePosition;

  addDependencyResult(dep, targetFile, ctx);
}

function collectCoordsDependency(
  content: string,
  node: XmlDocument,
  packageFile: string,
  ctx: WalkContext,
): void {
  const coords = parseCoords(node.attr.coords);
  if (!coords) {
    return;
  }

  const { currentValue, sharedVariableName, property } =
    resolveVersionReference(coords.rawVersion, ctx.propertyMap);

  const range = readAttributeRange(content, node, 'coords', node.attr.coords);
  /* v8 ignore next 3 -- readAttributeRange only fails if xmldoc misreports attributes */
  if (!range) {
    return;
  }

  const versionPositionInCoords = node.attr.coords.lastIndexOf(
    coords.rawVersion,
  );
  /* v8 ignore next 3 -- rawVersion was extracted from coords so it always exists */
  if (versionPositionInCoords === -1) {
    return;
  }

  const dep: PackageDependency = {
    datasource: MavenDatasource.id,
    depName: coords.depName,
    depType: getDependencyType(node.attr.scope, coords.depType),
    registryUrls: [],
  };

  if (currentValue) {
    dep.currentValue = currentValue;
  } else {
    dep.currentValue = coords.rawVersion;
    dep.skipReason = 'contains-variable';
  }

  if (sharedVariableName) {
    dep.sharedVariableName = sharedVariableName;
  }

  const targetFile = property?.packageFile ?? packageFile;
  dep.fileReplacePosition =
    property?.fileReplacePosition ??
    range.valuePosition + versionPositionInCoords;

  addDependencyResult(dep, targetFile, ctx);
}

async function walkNode(
  content: string,
  node: XmlDocument,
  packageFile: string,
  ctx: WalkContext,
): Promise<void> {
  for (const child of node.children) {
    if (!isXmlElement(child)) {
      continue;
    }

    if (child.name === 'property') {
      if (child.attr.name && child.attr.value) {
        const propRange = readAttributeRange(
          content,
          child,
          'value',
          child.attr.value,
        );
        if (propRange) {
          addProperty(
            ctx,
            child.attr.name,
            child.attr.value,
            propRange.valuePosition,
            packageFile,
          );
        }
      } else if (child.attr.file) {
        const propFilePath = upath.join(
          upath.dirname(packageFile),
          child.attr.file,
        );
        await walkPropertiesFile(propFilePath, ctx);
      }
    } else if (child.name === 'dependency') {
      collectDependency(content, child, packageFile, ctx);
    } else {
      await walkNode(content, child, packageFile, ctx);
    }
  }
}

async function walkPropertiesFile(
  filePath: string,
  ctx: WalkContext,
): Promise<void> {
  if (ctx.visitedPropertiesFiles.has(filePath)) {
    return;
  }
  ctx.visitedPropertiesFiles.add(filePath);

  const content = await readLocalFile(filePath, 'utf8');
  if (!content) {
    logger.debug(`ant manager: could not read properties file ${filePath}`);
    return;
  }

  parsePropertiesFile(content, filePath, ctx);
}

async function walkXmlFile(
  packageFile: string,
  ctx: WalkContext,
): Promise<void> {
  if (ctx.visitedXmlFiles.has(packageFile)) {
    return;
  }
  ctx.visitedXmlFiles.add(packageFile);

  const content = await readLocalFile(packageFile, 'utf8');
  if (!content) {
    logger.debug(`ant manager: could not read ${packageFile}`);
    return;
  }

  let doc: XmlDocument;
  try {
    doc = new XmlDocument(content);
  } catch {
    logger.debug(`ant manager: could not parse XML ${packageFile}`);
    return;
  }

  await walkNode(content, doc, packageFile, ctx);
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFileContent[] | null> {
  const ctx: WalkContext = {
    propertyMap: new Map(),
    visitedXmlFiles: new Set(),
    visitedPropertiesFiles: new Set(),
    results: new Map(),
  };

  for (const packageFile of packageFiles) {
    await walkXmlFile(packageFile, ctx);
  }

  const results = [...ctx.results.values()].filter((r) => r.deps.length > 0);
  return results.length > 0 ? results : null;
}
