import upath from 'upath';
import type { XmlElement } from 'xmldoc';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import { extractRegistries } from '../maven/extract.ts';
import { isXmlElement } from '../nuget/util.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import {
  applyProps,
  containsPlaceholder,
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

function parseCoords(coordsStr: string): {
  groupId: string;
  artifactId: string;
  rawVersion: string;
  scope: string | undefined;
} | null {
  const parts = coordsStr.split(':');
  if (parts.length < 3) {
    logger.trace({ coordsStr }, 'ant manager: coords has fewer than 3 parts');
    return null;
  }

  const [groupId, artifactId] = parts;
  if (!groupId || !artifactId) {
    logger.trace(
      { coordsStr },
      'ant manager: coords has empty groupId or artifactId',
    );
    return null;
  }

  let scope: string | undefined;
  let rawVersion: string;

  if (parts.length >= 4 && scopeNames.has(parts.at(-1)!)) {
    scope = parts.at(-1);
    rawVersion = parts.at(-2)!;
  } else {
    rawVersion = parts.at(-1)!;
  }

  return { groupId, artifactId, rawVersion, scope };
}

interface RawDep {
  dep: PackageDependency;
  depPackageFile: string;
}

async function collectRegistryUrls(
  node: XmlElement,
  baseDir: string,
): Promise<string[]> {
  const urls: string[] = [];

  // Read registry URLs from settingsFile attribute
  const settingsFile = node.attr.settingsFile;
  if (settingsFile) {
    const settingsPath = settingsFile.startsWith('/')
      ? settingsFile
      : upath.join(baseDir, settingsFile);
    const settingsContent = await readLocalFile(settingsPath, 'utf8');
    if (settingsContent) {
      urls.push(...extractRegistries(settingsContent));
    } else {
      logger.debug(`ant manager: could not read settings file ${settingsPath}`);
    }
  }

  // Collect inline <remoteRepository url="..." /> elements
  for (const child of node.children) {
    if (
      isXmlElement(child) &&
      child.name === 'remoteRepository' &&
      child.attr.url
    ) {
      urls.push(child.attr.url);
    }
  }

  return [...new Set(urls)];
}

function collectCoordsDependency(
  node: XmlElement,
  packageFile: string,
  content: string,
  registryUrls: string[],
): RawDep | null {
  const coordsStr = node.attr.coords;

  const parsed = parseCoords(coordsStr);
  if (!parsed) {
    return null;
  }

  const dep: PackageDependency = {
    datasource: MavenDatasource.id,
    depName: `${parsed.groupId}:${parsed.artifactId}`,
    currentValue: parsed.rawVersion,
    depType: getDependencyType(parsed.scope ?? node.attr.scope),
    ...(registryUrls?.length && { registryUrls }),
  };

  // Position at the version substring within the coords attribute value
  const coordsValuePos = findAttrValuePosition(content, node, 'coords');
  const versionOffset = coordsStr.lastIndexOf(parsed.rawVersion);
  dep.fileReplacePosition = coordsValuePos + versionOffset;

  return { dep, depPackageFile: packageFile };
}

function collectDependency(
  node: XmlElement,
  packageFile: string,
  content: string,
  registryUrls: string[] = [],
): RawDep | null {
  if (node.attr.coords) {
    return collectCoordsDependency(node, packageFile, content, registryUrls);
  }

  const { groupId, artifactId, version, scope } = node.attr;

  if (!version || !groupId || !artifactId) {
    return null;
  }

  const dep: PackageDependency = {
    datasource: MavenDatasource.id,
    depName: `${groupId}:${artifactId}`,
    currentValue: version,
    depType: getDependencyType(scope),
    ...(registryUrls?.length && { registryUrls }),
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

/**
 * Walk an XML node tree in document order, processing properties,
 * property file references, and dependencies as they appear.
 */
async function walkNodeInOrder(
  node: XmlElement | XmlDocument,
  packageFile: string,
  content: string,
  visitedFiles: Set<string>,
  allProps: Record<string, AntProp>,
  allRawDeps: RawDep[],
  registryUrls: string[] = [],
): Promise<void> {
  const baseDir = upath.dirname(packageFile);

  for (const child of node.children) {
    if (!isXmlElement(child)) {
      continue;
    }

    if (child.name === 'property') {
      // Handle inline property definition
      const name = child.attr.name;
      const value = child.attr.value;
      if (name && value && !(name in allProps)) {
        const pos = findAttrValuePosition(content, child, 'value');
        allProps[name] = { val: value, fileReplacePosition: pos, packageFile };
      }

      // Handle property file reference
      const file = child.attr.file;
      if (file) {
        if (containsPlaceholder(file)) {
          logger.debug(
            `ant manager: skipping properties file with unresolved placeholders in path: ${file}`,
          );
        } else {
          const propFilePath = file.startsWith('/')
            ? file
            : upath.join(baseDir, file);

          if (!visitedFiles.has(propFilePath)) {
            visitedFiles.add(propFilePath);
            const propContent = await readLocalFile(propFilePath, 'utf8');
            if (propContent) {
              parsePropertiesFile(propContent, propFilePath, allProps);
            } else {
              logger.debug(
                `ant manager: could not read properties file ${propFilePath}`,
              );
            }
          }
        }
      }
    } else if (child.name === 'import' && child.attr.file) {
      if (containsPlaceholder(child.attr.file)) {
        logger.debug(
          `ant manager: skipping import file with unresolved placeholders in path: ${child.attr.file}`,
        );
      } else {
        const importedFile = upath.normalize(
          upath.join(baseDir, child.attr.file),
        );
        await walkXmlFile(importedFile, visitedFiles, allProps, allRawDeps);
      }
    } else if (child.name === 'dependency') {
      const rawDep = collectDependency(
        child,
        packageFile,
        content,
        registryUrls,
      );
      if (rawDep) {
        allRawDeps.push(rawDep);
      }
    } else {
      // Collect registry URLs from settingsFile and remoteRepository
      const childRegistries = await collectRegistryUrls(child, baseDir);
      const mergedUrls =
        childRegistries.length > 0 ? childRegistries : registryUrls;
      await walkNodeInOrder(
        child,
        packageFile,
        content,
        visitedFiles,
        allProps,
        allRawDeps,
        mergedUrls,
      );
    }
  }
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

  await walkNodeInOrder(
    doc,
    packageFile,
    content,
    visitedFiles,
    allProps,
    allRawDeps,
  );
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const results: PackageFile[] = [];
  const seen = new Set<string>();

  for (const packageFile of packageFiles) {
    if (seen.has(packageFile)) {
      continue;
    }
    seen.add(packageFile);

    const visitedFiles = new Set<string>();
    const allProps: Record<string, AntProp> = {};
    const allRawDeps: RawDep[] = [];

    await walkXmlFile(packageFile, visitedFiles, allProps, allRawDeps);

    // Resolve chained property values before applying to deps
    resolveChainedProps(allProps);

    // Apply property resolution to all dependencies
    const resolvedDeps = allRawDeps.map((rawDep) =>
      applyProps(rawDep.dep, rawDep.depPackageFile, allProps),
    );

    if (resolvedDeps.length === 0) {
      continue;
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

    for (const [pkgFile, deps] of fileMap) {
      // Clean up internal propSource field
      for (const dep of deps) {
        delete dep.propSource;
      }
      results.push({ packageFile: pkgFile, deps });
    }
  }

  return results.length > 0 ? results : null;
}
