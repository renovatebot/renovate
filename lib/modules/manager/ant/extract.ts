import { dirname, join } from 'upath';
import type { XmlElement } from 'xmldoc';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import { isXmlElement } from '../nuget/util.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import type { AntProp } from './types.ts';

const scopeNames = new Set([
  'compile',
  'runtime',
  'test',
  'provided',
  'system',
]);

const placeholderRegex = regEx(/\$\{([^}]+)}/g);
const fullPlaceholderRegex = regEx(/^\$\{([^}]+)}$/);

function getDependencyType(scope: string | undefined): string {
  if (scope && scopeNames.has(scope)) {
    return scope;
  }
  return 'compile';
}

const placeholderTestRegex = regEx(/\$\{[^}]+}/);

function containsPlaceholder(str: string | null | undefined): boolean {
  return !!str && placeholderTestRegex.test(str);
}

/**
 * Find the byte offset of an attribute's value in raw XML content.
 * Returns the offset of the first character of the value (after the opening quote).
 */
function findAttrValuePosition(
  content: string,
  node: XmlElement,
  attrName: string,
): number | null {
  // Search from the node's start position in the content
  const startTag = node.startTagPosition;
  if (startTag === undefined || startTag === null) {
    return null;
  }

  // Find the closing of this element's start tag
  const tagEnd = content.indexOf('>', startTag);
  if (tagEnd === -1) {
    return null;
  }
  const tagContent = content.slice(startTag, tagEnd + 1);

  // Match attrName="value" or attrName='value'
  const attrPattern = regEx(`${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
  const match = attrPattern.exec(tagContent);
  if (!match) {
    return null;
  }

  const valueInMatch = match[1] ?? match[2];
  const valueOffset = match[0].indexOf(valueInMatch);
  return startTag + match.index + valueOffset;
}

/**
 * Parse a .properties file into a map of property names to AntProp.
 * Implements first-definition-wins: if a key already exists in the map, it is not overwritten.
 */
export function parsePropertiesFile(
  content: string,
  packageFile: string,
  props: Record<string, AntProp>,
): void {
  let offset = 0;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    // Skip comments and blank lines
    if (line.startsWith('#') || line.startsWith('!') || line === '') {
      offset += rawLine.length + 1; // +1 for newline
      continue;
    }

    // Match key=value, key:value, or key value (first separator wins)
    const separatorMatch = regEx(/^([^=:\s]+)\s*[=:\s]\s*(.*)$/).exec(line);
    if (separatorMatch) {
      const key = separatorMatch[1];
      const val = separatorMatch[2].trim();

      // First-definition-wins
      if (!(key in props)) {
        // fileReplacePosition points to the start of the value in the raw content
        const lineStart = offset + rawLine.indexOf(line);
        const keyEnd = line.indexOf(separatorMatch[2]);
        const fileReplacePosition = lineStart + keyEnd;

        props[key] = { val, fileReplacePosition, packageFile };
      }
    }

    offset += rawLine.length + 1;
  }
}

interface RawDep {
  dep: PackageDependency;
  depPackageFile: string;
}

/**
 * Collect inline <property name="..." value="..."/> elements.
 * Implements first-definition-wins.
 */
function collectProperties(
  node: XmlElement | XmlDocument,
  content: string,
  packageFile: string,
  props: Record<string, AntProp>,
): void {
  for (const child of node.children) {
    if (!isXmlElement(child)) {
      continue;
    }

    if (child.name === 'property') {
      const name = child.attr.name;
      const value = child.attr.value;
      if (name && value && !(name in props)) {
        const pos = findAttrValuePosition(content, child, 'value');
        if (pos !== null) {
          props[name] = { val: value, fileReplacePosition: pos, packageFile };
        }
      }
    }

    collectProperties(child, content, packageFile, props);
  }
}

/**
 * Collect <property file="..."/> references to external properties files.
 */
function collectPropertyFileRefs(node: XmlElement | XmlDocument): string[] {
  const files: string[] = [];
  for (const child of node.children) {
    if (!isXmlElement(child)) {
      continue;
    }

    if (child.name === 'property' && child.attr.file) {
      files.push(child.attr.file);
    }

    files.push(...collectPropertyFileRefs(child));
  }
  return files;
}

function collectDependency(
  node: XmlElement,
  packageFile: string,
  content: string,
): RawDep | null {
  const { groupId, artifactId, version, scope } = node.attr;

  if (!version || !groupId || !artifactId) {
    return null;
  }

  const dep: PackageDependency = {
    datasource: MavenDatasource.id,
    depName: `${groupId}:${artifactId}`,
    currentValue: version,
    depType: getDependencyType(scope),
    registryUrls: [],
  };

  // Track the position of the version attribute value for inline versions
  const pos = findAttrValuePosition(content, node, 'version');
  if (pos !== null) {
    dep.fileReplacePosition = pos;
  }

  return { dep, depPackageFile: packageFile };
}

function walkNode(
  node: XmlElement | XmlDocument,
  rawDeps: RawDep[],
  packageFile: string,
  content: string,
): void {
  for (const child of node.children) {
    if (!isXmlElement(child)) {
      continue;
    }

    if (child.name === 'dependency') {
      const rawDep = collectDependency(child, packageFile, content);
      if (rawDep) {
        rawDeps.push(rawDep);
      }
    } else {
      walkNode(child, rawDeps, packageFile, content);
    }
  }
}

/**
 * Apply property resolution to a dependency.
 * Handles chained references with circular detection.
 */
function applyProps(
  rawDep: RawDep,
  props: Record<string, AntProp>,
): PackageDependency {
  const { dep, depPackageFile } = rawDep;
  const currentValue = dep.currentValue;

  if (!currentValue || !containsPlaceholder(currentValue)) {
    return dep;
  }

  // Check if the entire version is a single property reference
  const fullMatch = fullPlaceholderRegex.exec(currentValue);
  if (!fullMatch) {
    // Partial placeholder in version string - not supported for updates
    dep.skipReason = 'version-placeholder';
    return dep;
  }

  const propKey = fullMatch[1];
  const prop = props[propKey];
  if (!prop) {
    dep.skipReason = 'version-placeholder';
    return dep;
  }

  // After resolveChainedProps, prop.val is either fully resolved or still contains
  // placeholders (meaning circular or unresolvable)
  if (containsPlaceholder(prop.val)) {
    dep.skipReason = 'recursive-placeholder';
    return dep;
  }

  dep.currentValue = prop.val;
  dep.sharedVariableName = propKey;
  dep.fileReplacePosition = prop.fileReplacePosition;
  if (prop.packageFile !== depPackageFile) {
    dep.editFile = prop.packageFile;
  }
  // propSource is used to route deps to the correct PackageFile
  dep.propSource = prop.packageFile;
  return dep;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  let doc: XmlDocument;
  try {
    doc = new XmlDocument(content);
  } catch {
    logger.debug(`ant manager: could not parse XML ${packageFile}`);
    return null;
  }

  const rawDeps: RawDep[] = [];
  walkNode(doc, rawDeps, packageFile, content);

  const deps = rawDeps.map((rd) => rd.dep);

  if (deps.length === 0) {
    return null;
  }

  return { deps };
}

async function walkXmlFile(
  packageFile: string,
  visitedFiles: Set<string>,
  allProps: Record<string, AntProp>,
  allRawDeps: RawDep[],
): Promise<void> {
  if (visitedFiles.has(packageFile)) {
    return;
  }
  visitedFiles.add(packageFile);

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

  // Collect property file references first (order matters for first-definition-wins)
  const propertyFileRefs = collectPropertyFileRefs(doc);

  // Collect inline properties (first-definition-wins: inline before file refs)
  collectProperties(doc, content, packageFile, allProps);

  // Load external .properties files
  const baseDir = dirname(packageFile);
  for (const ref of propertyFileRefs) {
    const propFilePath = ref.startsWith('/') ? ref : join(baseDir, ref);

    if (visitedFiles.has(propFilePath)) {
      continue;
    }
    visitedFiles.add(propFilePath);

    const propContent = await readLocalFile(propFilePath, 'utf8');
    if (!propContent) {
      logger.debug(
        `ant manager: could not read properties file ${propFilePath}`,
      );
      continue;
    }

    parsePropertiesFile(propContent, propFilePath, allProps);
  }

  // Collect dependencies
  walkNode(doc, allRawDeps, packageFile, content);
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const visitedFiles = new Set<string>();
  const allProps: Record<string, AntProp> = {};
  const allRawDeps: RawDep[] = [];

  for (const packageFile of packageFiles) {
    await walkXmlFile(packageFile, visitedFiles, allProps, allRawDeps);
  }

  // Resolve chained property values before applying to deps
  resolveChainedProps(allProps);

  // Apply property resolution to all dependencies
  const resolvedDeps = allRawDeps.map((rawDep) => applyProps(rawDep, allProps));

  if (resolvedDeps.length === 0) {
    return null;
  }

  // Group deps by their target file (propSource or original packageFile)
  const fileMap = new Map<string, PackageDependency[]>();
  for (let i = 0; i < resolvedDeps.length; i++) {
    const dep = resolvedDeps[i];
    const targetFile = dep.propSource ?? allRawDeps[i].depPackageFile;
    if (!fileMap.has(targetFile)) {
      fileMap.set(targetFile, []);
    }
    fileMap.get(targetFile)!.push(dep);
  }

  const results: PackageFile[] = [];
  for (const [packageFile, deps] of fileMap) {
    // Clean up internal propSource field
    for (const dep of deps) {
      delete dep.propSource;
    }
    results.push({ packageFile, deps });
  }

  return results.length > 0 ? results : null;
}

/**
 * Resolve chained property references within the property map itself.
 * E.g., if prop A = "${B}" and prop B = "1.0", resolve A to "1.0".
 * Marks circular properties by setting val to a placeholder that will be caught later.
 */
function resolveChainedProps(props: Record<string, AntProp>): void {
  const resolved = new Map<string, string | null>(); // null = circular

  function resolve(key: string, chain: Set<string>): string | null {
    if (resolved.has(key)) {
      return resolved.get(key)!;
    }
    if (chain.has(key)) {
      // Circular reference detected
      resolved.set(key, null);
      return null;
    }
    const prop = props[key];
    if (!prop) {
      return null;
    }
    if (!containsPlaceholder(prop.val)) {
      resolved.set(key, prop.val);
      return prop.val;
    }

    chain.add(key);
    let isCircular = false;
    const val = prop.val.replace(placeholderRegex, (match, refKey: string) => {
      const refResult = resolve(refKey, chain);
      if (refResult === null) {
        isCircular = true;
        return match;
      }
      return refResult;
    });
    chain.delete(key);

    if (isCircular) {
      resolved.set(key, null);
      return null;
    }

    resolved.set(key, val);
    prop.val = val;
    return val;
  }

  for (const key of Object.keys(props)) {
    resolve(key, new Set());
  }
}
