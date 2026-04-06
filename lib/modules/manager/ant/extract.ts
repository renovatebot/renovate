import type { XmlElement } from 'xmldoc';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import { isXmlElement } from '../nuget/util.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
} from '../types.ts';

const scopeNames = new Set([
  'compile',
  'runtime',
  'test',
  'provided',
  'system',
]);

function getDependencyType(scope: string | undefined): string {
  if (scope && scopeNames.has(scope)) {
    return scope;
  }
  return 'compile';
}

function collectDependency(node: XmlElement): PackageDependency | null {
  const { groupId, artifactId, version, scope } = node.attr;

  if (!version || !groupId || !artifactId) {
    return null;
  }

  return {
    datasource: MavenDatasource.id,
    depName: `${groupId}:${artifactId}`,
    currentValue: version,
    depType: getDependencyType(scope),
    registryUrls: [],
  };
}

function walkNode(
  node: XmlElement | XmlDocument,
  deps: PackageDependency[],
): void {
  for (const child of node.children) {
    if (!isXmlElement(child)) {
      continue;
    }

    if (child.name === 'dependency') {
      const dep = collectDependency(child);
      if (dep) {
        deps.push(dep);
      }
    } else {
      walkNode(child, deps);
    }
  }
}

async function walkXmlFile(
  packageFile: string,
  visitedFiles: Set<string>,
): Promise<PackageFile | null> {
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
  walkNode(doc, deps);

  if (deps.length === 0) {
    return null;
  }

  return { packageFile, deps };
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const results: PackageFile[] = [];
  const visitedFiles = new Set<string>();

  for (const packageFile of packageFiles) {
    const result = await walkXmlFile(packageFile, visitedFiles);
    if (result) {
      results.push(result);
    }
  }

  return results.length > 0 ? results : null;
}
