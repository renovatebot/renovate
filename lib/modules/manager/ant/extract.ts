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

function getDependencyType(scope: string | undefined): string {
  if (scope && scopeNames.has(scope)) {
    return scope;
  }
  return 'compile';
}

function collectDependency(
  content: string,
  node: XmlDocument,
): PackageDependency | null {
  const { groupId, artifactId, version, scope } = node.attr;

  if (!version || !groupId || !artifactId) {
    return null;
  }

  const range = readAttributeRange(content, node, 'version', version);
  /* v8 ignore next 3 -- readAttributeRange only fails if xmldoc misreports attributes */
  if (!range) {
    return null;
  }

  return {
    datasource: MavenDatasource.id,
    depName: `${groupId}:${artifactId}`,
    currentValue: version,
    depType: getDependencyType(scope),
    fileReplacePosition: range.valuePosition,
    registryUrls: [],
  };
}

function walkNode(
  content: string,
  node: XmlDocument,
  deps: PackageDependency[],
): void {
  for (const child of node.children) {
    if (!isXmlElement(child)) {
      continue;
    }

    if (child.name === 'dependency') {
      const dep = collectDependency(content, child);
      if (dep) {
        deps.push(dep);
      }
    } else {
      walkNode(content, child, deps);
    }
  }
}

async function walkXmlFile(
  packageFile: string,
  visitedFiles: Set<string>,
): Promise<PackageFileContent | null> {
  if (visitedFiles.has(packageFile)) {
    return null;
  }
  visitedFiles.add(packageFile);

  const content = await readLocalFile(packageFile, 'utf8');
  if (!content) {
    logger.debug(`ant manager: could not read ${packageFile}`);
    return null;
  }

  let doc: XmlDocument;
  try {
    doc = new XmlDocument(content);
  } catch {
    logger.debug(`ant manager: could not parse XML ${packageFile}`);
    return null;
  }

  const deps: PackageDependency[] = [];
  walkNode(content, doc, deps);

  if (deps.length === 0) {
    return null;
  }

  return { packageFile, deps };
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFileContent[] | null> {
  const results: PackageFileContent[] = [];
  const visitedFiles = new Set<string>();

  for (const packageFile of packageFiles) {
    const result = await walkXmlFile(packageFile, visitedFiles);
    if (result) {
      results.push(result);
    }
  }

  return results.length > 0 ? results : null;
}
