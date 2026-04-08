import type { XmlDocument, XmlElement } from 'xmldoc';
import { regEx } from '../../../util/regex.ts';
import { isXmlElement } from '../nuget/util.ts';
import type { PackageDependency } from '../types.ts';
import type { AntProp } from './types.ts';

const placeholderRegex = regEx(/\$\{([^}]+)}/g);
const fullPlaceholderRegex = regEx(/^\$\{([^}]+)}$/);
const placeholderTestRegex = regEx(/\$\{[^}]+}/);
const propertySeparatorRegex = regEx(/^([^=:\s]+)\s*[=:\s]\s*(.*)$/);

export function containsPlaceholder(str: string | null | undefined): boolean {
  return !!str && placeholderTestRegex.test(str);
}

/**
 * Find the byte offset of an attribute's value in raw XML content.
 * Returns the offset of the first character of the value (after the opening quote).
 */
export function findAttrValuePosition(
  content: string,
  node: XmlElement,
  attrName: string,
): number {
  const startTag = node.startTagPosition!;
  const tagEnd = content.indexOf('>', startTag);
  const tagContent = content.slice(startTag, tagEnd + 1);

  const attrPattern = regEx(`${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
  const match = attrPattern.exec(tagContent)!;

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
    const separatorMatch = propertySeparatorRegex.exec(line);
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

/**
 * Collect inline <property name="..." value="..."/> elements.
 * Implements first-definition-wins.
 */
export function collectProperties(
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
        props[name] = { val: value, fileReplacePosition: pos, packageFile };
      }
    }

    collectProperties(child, content, packageFile, props);
  }
}

/**
 * Collect <property file="..."/> references to external properties files.
 */
export function collectPropertyFileRefs(
  node: XmlElement | XmlDocument,
): string[] {
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

/**
 * Apply property resolution to a dependency.
 * Handles chained references with circular detection.
 */
export function applyProps(
  dep: PackageDependency,
  depPackageFile: string,
  props: Record<string, AntProp>,
): PackageDependency {
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

/**
 * Resolve chained property references within the property map itself.
 * E.g., if prop A = "${B}" and prop B = "1.0", resolve A to "1.0".
 * Marks circular properties by setting val to a placeholder that will be caught later.
 */
export function resolveChainedProps(props: Record<string, AntProp>): void {
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
