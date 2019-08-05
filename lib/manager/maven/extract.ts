import { basename, dirname, normalize, join } from 'path';
import { XmlDocument, XmlElement } from 'xmldoc';
import { isValid } from '../../versioning/maven';
import { logger } from '../../logger';
import { ExtractConfig, PackageFile, PackageDependency } from '../common';

export const DEFAULT_MAVEN_REPO = 'https://repo.maven.apache.org/maven2';

export function parsePom(raw: string) {
  let project: XmlDocument;
  try {
    project = new XmlDocument(raw);
  } catch (e) {
    return null;
  }
  const { name, attr } = project;
  if (name !== 'project') return null;
  if (attr.xmlns !== 'http://maven.apache.org/POM/4.0.0') return null;
  return project;
}

export function containsPlaceholder(str: string) {
  return /\${.*?}/g.test(str);
}

interface MavenProp {
  val: string;
  fileReplacePosition: number;
  packageFile: string;
}

function depFromNode(node: XmlElement): PackageDependency {
  if (!node.valueWithPath) return null;
  const groupId = node.valueWithPath('groupId');
  const artifactId = node.valueWithPath('artifactId');
  const currentValue = node.valueWithPath('version');
  if (groupId && artifactId && currentValue) {
    const depName = `${groupId}:${artifactId}`;
    const versionNode = node.descendantWithPath('version');
    const fileReplacePosition = versionNode.position;
    const datasource = 'maven';
    const registryUrls = [DEFAULT_MAVEN_REPO];
    return {
      datasource,
      depName,
      currentValue,
      fileReplacePosition,
      registryUrls,
    };
  }
  return null;
}

function deepExtract(
  node: XmlElement,
  result = [],
  isRoot = true
): PackageDependency[] {
  const dep = depFromNode(node as XmlElement);
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
  props: MavenProp
) {
  const replaceAll = (str: string) =>
    str.replace(/\${.*?}/g, substr => {
      const propKey = substr.slice(2, -1).trim();
      const propValue = props[propKey];
      return propValue ? propValue.val : substr;
    });

  const depName = replaceAll(dep.depName);
  const registryUrls = dep.registryUrls.map(url => replaceAll(url));

  let fileReplacePosition = dep.fileReplacePosition;
  let propSource = null;
  let groupName = null;
  const currentValue = dep.currentValue.replace(/^\${.*?}$/, substr => {
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
    result.skipReason = 'name-placeholder';
  } else if (containsPlaceholder(currentValue)) {
    result.skipReason = 'version-placeholder';
  } else if (!isValid(currentValue)) {
    result.skipReason = 'not-a-version';
  }

  return result;
}

function resolveParentFile(packageFile: string, parentPath: string) {
  let parentFile = 'pom.xml';
  let parentDir = parentPath;
  const parentBasename = basename(parentPath);
  if (parentBasename === 'pom.xml' || /\.pom\.xml$/.test(parentBasename)) {
    parentFile = parentBasename;
    parentDir = dirname(parentPath);
  }
  const dir = dirname(packageFile);
  return normalize(join(dir, parentDir, parentFile));
}

export function extractPackage(rawContent: string, packageFile: string = null) {
  if (!rawContent) return null;

  const project = parsePom(rawContent);
  if (!project) return null;

  const result: PackageFile = {
    datasource: 'maven',
    packageFile,
    deps: [],
  };

  result.deps = deepExtract(project);

  const propsNode = project.childNamed('properties');
  const props: Record<string, MavenProp> = {};
  if (propsNode && propsNode.children) {
    for (const propNode of propsNode.children as XmlElement[]) {
      const key = propNode.name;
      const val = propNode.val && propNode.val.trim();
      if (key && val) {
        const fileReplacePosition = propNode.position;
        props[key] = { val, fileReplacePosition, packageFile };
      }
    }
  }
  result.mavenProps = props;

  const repositories = project.childNamed('repositories');
  if (repositories && repositories.children) {
    const repoUrls = [];
    for (const repo of repositories.childrenNamed('repository')) {
      const repoUrl = repo.valueWithPath('url');
      if (repoUrl) {
        repoUrls.push(repoUrl);
      }
    }
    result.deps.forEach(dep => {
      if (dep.registryUrls) {
        repoUrls.forEach(url => dep.registryUrls.push(url));
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

export function resolveProps(packages: PackageFile[]): PackageFile[] {
  const packageFileNames: string[] = [];
  const extractedPackages: Record<string, PackageFile> = {};
  const extractedDeps: Record<string, PackageDependency[]> = {};
  const extractedProps: Record<string, MavenProp> = {};
  packages.forEach(pkg => {
    const name = pkg.packageFile;
    packageFileNames.push(name);
    extractedPackages[name] = pkg;
    extractedDeps[name] = [];
  });

  // Construct package-specific prop scopes
  // and merge them in reverse order,
  // which allows inheritance/overriding.
  packageFileNames.forEach(name => {
    const hierarchy: Record<string, MavenProp>[] = [];
    const alreadyExtracted: Record<string, boolean> = {};
    let pkg = extractedPackages[name];
    while (pkg) {
      hierarchy.unshift(pkg.mavenProps);
      if (pkg.parent && !alreadyExtracted[pkg.parent]) {
        alreadyExtracted[pkg.parent] = true;
        pkg = extractedPackages[pkg.parent];
      } else {
        pkg = null;
      }
    }
    hierarchy.unshift({});
    // @ts-ignore
    extractedProps[name] = Object.assign.apply(null, hierarchy);
  });

  // Resolve placeholders
  packageFileNames.forEach(name => {
    const pkg = extractedPackages[name];
    pkg.deps.forEach(rawDep => {
      const dep = applyProps(rawDep, extractedProps[name]);
      const sourceName = dep.propSource || name;
      extractedDeps[sourceName].push(dep);
    });
  });

  return packageFileNames.map(name => ({
    ...extractedPackages[name],
    deps: extractedDeps[name],
  }));
}

function cleanResult(packageFiles) {
  packageFiles.forEach(packageFile => {
    delete packageFile.mavenProps; // eslint-disable-line no-param-reassign
    packageFile.deps.forEach(dep => {
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
    const content = await platform.getFile(packageFile);
    if (content) {
      const pkg = extractPackage(content, packageFile);
      if (pkg) {
        packages.push(pkg);
      } else {
        logger.info({ packageFile }, 'can not read dependencies');
      }
    } else {
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }

  return cleanResult(resolveProps(packages));
}
