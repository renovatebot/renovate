import upath from 'upath';
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
  PackageFileContent,
} from '../types.ts';
import {
  applyProps,
  collectProperties,
  collectPropertyFileRefs,
  findAttrValuePosition,
  parsePropertiesFile,
  resolveChainedProps,
} from './properties.ts';
import type { AntProp } from './types.ts';

export { parsePropertiesFile } from './properties.ts';

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

interface RawDep {
  dep: PackageDependency;
  depPackageFile: string;
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

  dep.fileReplacePosition = findAttrValuePosition(content, node, 'version');

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
  const baseDir = upath.dirname(packageFile);
  for (const ref of propertyFileRefs) {
    const propFilePath = ref.startsWith('/') ? ref : upath.join(baseDir, ref);

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
  const resolvedDeps = allRawDeps.map((rawDep) =>
    applyProps(rawDep.dep, rawDep.depPackageFile, allProps),
  );

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

  return results;
}
