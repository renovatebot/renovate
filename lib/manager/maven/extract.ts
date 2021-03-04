import is from '@sindresorhus/is';
import { basename, dirname, join, normalize } from 'upath';
import { XmlDocument, XmlElement } from 'xmldoc';
import * as datasourceMaven from '../../datasource/maven';
import { MAVEN_REPO } from '../../datasource/maven/common';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { readLocalFile } from '../../util/fs';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

export function parsePom(raw: string): XmlDocument | null {
  let project: XmlDocument;
  try {
    project = new XmlDocument(raw);
  } catch (e) {
    return null;
  }
  const { name, attr, children } = project;
  if (name !== 'project') {
    return null;
  }
  if (attr.xmlns === 'http://maven.apache.org/POM/4.0.0') {
    return project;
  }
  if (
    is.nonEmptyArray(children) &&
    children.some((c: any) => c.name === 'modelVersion' && c.val === '4.0.0')
  ) {
    return project;
  }
  return null;
}

function containsPlaceholder(str: string): boolean {
  return /\${.*?}/g.test(str);
}

interface MavenProp {
  val: string;
  fileReplacePosition: number;
  packageFile: string;
}

function depFromNode(node: XmlElement): PackageDependency | null {
  if (!('valueWithPath' in node)) {
    return null;
  }
  let groupId = node.valueWithPath('groupId');
  const artifactId = node.valueWithPath('artifactId');
  const currentValue = node.valueWithPath('version');

  if (!groupId && node.name === 'plugin') {
    groupId = 'org.apache.maven.plugins';
  }

  if (groupId && artifactId && currentValue) {
    const depName = `${groupId}:${artifactId}`;
    const versionNode = node.descendantWithPath('version');
    const fileReplacePosition = versionNode.position;
    const datasource = datasourceMaven.id;
    const registryUrls = [MAVEN_REPO];
    const result: PackageDependency = {
      datasource,
      depName,
      currentValue,
      fileReplacePosition,
      registryUrls,
    };

    const depType = node.valueWithPath('scope');
    if (depType) {
      result.depType = depType;
    }

    return result;
  }
  return null;
}

function deepExtract(
  node: XmlElement,
  result: PackageDependency[] = [],
  isRoot = true
): PackageDependency[] {
  const dep = depFromNode(node);
  if (dep && !isRoot) {
    result.push(dep);
  }
  if (node.children) {
    for (const child of node.children) {
      deepExtract(child as XmlElement, result, false);
    }
  }
  return result;
}

function applyProps(
  dep: PackageDependency<Record<string, any>>,
  depPackageFile: string,
  props: MavenProp
): PackageDependency<Record<string, any>> {
  const replaceAll = (str: string): string =>
    str.replace(/\${.*?}/g, (substr) => {
      const propKey = substr.slice(2, -1).trim();
      const propValue = props[propKey];
      return propValue ? propValue.val : substr;
    });

  const depName = replaceAll(dep.depName);
  const registryUrls = dep.registryUrls.map((url) => replaceAll(url));

  let fileReplacePosition = dep.fileReplacePosition;
  let propSource = null;
  let groupName = null;
  const currentValue = dep.currentValue.replace(/^\${.*?}$/, (substr) => {
    const propKey = substr.slice(2, -1).trim();
    const propValue = props[propKey];
    if (propValue) {
      if (!groupName) {
        groupName = propKey;
      }
      fileReplacePosition = propValue.fileReplacePosition;
      propSource = propValue.packageFile;
      return propValue.val;
    }
    return substr;
  });

  const result: PackageDependency = {
    ...dep,
    depName,
    registryUrls,
    fileReplacePosition,
    propSource,
    currentValue,
  };

  if (groupName) {
    result.groupName = groupName;
  }

  if (containsPlaceholder(depName)) {
    result.skipReason = SkipReason.NamePlaceholder;
  } else if (containsPlaceholder(currentValue)) {
    result.skipReason = SkipReason.VersionPlaceholder;
  }

  if (propSource && depPackageFile !== propSource) {
    result.editFile = propSource;
  }

  return result;
}

function resolveParentFile(packageFile: string, parentPath: string): string {
  let parentFile = 'pom.xml';
  let parentDir = parentPath;
  const parentBasename = basename(parentPath);
  if (parentBasename === 'pom.xml' || parentBasename.endsWith('.pom.xml')) {
    parentFile = parentBasename;
    parentDir = dirname(parentPath);
  }
  const dir = dirname(packageFile);
  return normalize(join(dir, parentDir, parentFile));
}

export function extractPackage(
  rawContent: string,
  packageFile: string | null = null
): PackageFile<Record<string, any>> | null {
  if (!rawContent) {
    return null;
  }

  const project = parsePom(rawContent);
  if (!project) {
    return null;
  }

  const result: PackageFile = {
    datasource: datasourceMaven.id,
    packageFile,
    deps: [],
  };

  result.deps = deepExtract(project);

  const propsNode = project.childNamed('properties');
  const props: Record<string, MavenProp> = {};
  if (propsNode?.children) {
    for (const propNode of propsNode.children as XmlElement[]) {
      const key = propNode.name;
      const val = propNode?.val?.trim();
      if (key && val) {
        const fileReplacePosition = propNode.position;
        props[key] = { val, fileReplacePosition, packageFile };
      }
    }
  }
  result.mavenProps = props;

  const repositories = project.childNamed('repositories');
  if (repositories?.children) {
    const repoUrls = [];
    for (const repo of repositories.childrenNamed('repository')) {
      const repoUrl = repo.valueWithPath('url');
      if (repoUrl) {
        repoUrls.push(repoUrl);
      }
    }
    result.deps.forEach((dep) => {
      if (dep.registryUrls) {
        repoUrls.forEach((url) => dep.registryUrls.push(url));
      }
    });
  }

  if (packageFile && project.childNamed('parent')) {
    const parentPath =
      project.valueWithPath('parent.relativePath') || '../pom.xml';
    result.parent = resolveParentFile(packageFile, parentPath);
  }

  return result;
}

export function resolveParents(packages: PackageFile[]): PackageFile[] {
  const packageFileNames: string[] = [];
  const extractedPackages: Record<string, PackageFile> = {};
  const extractedDeps: Record<string, PackageDependency[]> = {};
  const extractedProps: Record<string, MavenProp> = {};
  const registryUrls: Record<string, Set<string>> = {};
  packages.forEach((pkg) => {
    const name = pkg.packageFile;
    packageFileNames.push(name);
    extractedPackages[name] = pkg;
    extractedDeps[name] = [];
  });

  // Construct package-specific prop scopes
  // and merge them in reverse order,
  // which allows inheritance/overriding.
  packageFileNames.forEach((name) => {
    registryUrls[name] = new Set();
    const propsHierarchy: Record<string, MavenProp>[] = [];
    const visitedPackages: Set<string> = new Set();
    let pkg = extractedPackages[name];
    while (pkg) {
      propsHierarchy.unshift(pkg.mavenProps);

      if (pkg.deps) {
        pkg.deps.forEach((dep) => {
          if (dep.registryUrls) {
            dep.registryUrls.forEach((url) => {
              registryUrls[name].add(url);
            });
          }
        });
      }

      if (pkg.parent && !visitedPackages.has(pkg.parent)) {
        visitedPackages.add(pkg.parent);
        pkg = extractedPackages[pkg.parent];
      } else {
        pkg = null;
      }
    }
    propsHierarchy.unshift({});
    extractedProps[name] = Object.assign.apply(null, propsHierarchy as any);
  });

  // Resolve registryUrls
  packageFileNames.forEach((name) => {
    const pkg = extractedPackages[name];
    pkg.deps.forEach((rawDep) => {
      const urlsSet = new Set([...rawDep.registryUrls, ...registryUrls[name]]);
      rawDep.registryUrls = [...urlsSet]; // eslint-disable-line no-param-reassign
    });
  });

  // Resolve placeholders
  packageFileNames.forEach((name) => {
    const pkg = extractedPackages[name];
    pkg.deps.forEach((rawDep) => {
      const dep = applyProps(rawDep, name, extractedProps[name]);
      const sourceName = dep.propSource || name;
      extractedDeps[sourceName].push(dep);
    });
  });

  return packageFileNames.map((name) => ({
    ...extractedPackages[name],
    deps: extractedDeps[name],
  }));
}

function cleanResult(
  packageFiles: PackageFile<Record<string, any>>[]
): PackageFile<Record<string, any>>[] {
  packageFiles.forEach((packageFile) => {
    delete packageFile.mavenProps; // eslint-disable-line no-param-reassign
    packageFile.deps.forEach((dep) => {
      delete dep.propSource; // eslint-disable-line no-param-reassign
    });
  });
  return packageFiles;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[]> {
  const packages: PackageFile[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (content) {
      const pkg = extractPackage(content, packageFile);
      if (pkg) {
        packages.push(pkg);
      } else {
        logger.debug({ packageFile }, 'can not read dependencies');
      }
    } else {
      logger.debug({ packageFile }, 'packageFile has no content');
    }
  }
  return cleanResult(resolveParents(packages));
}
