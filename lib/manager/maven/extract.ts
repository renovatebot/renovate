import is from '@sindresorhus/is';
import upath from 'upath';
import { XmlDocument, XmlElement } from 'xmldoc';
import * as datasourceMaven from '../../datasource/maven';
import { MAVEN_REPO } from '../../datasource/maven/common';
import { logger } from '../../logger';
import { readLocalFile } from '../../util/fs';
import { regEx } from '../../util/regex';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type {
  MavenMirror,
  MavenProp,
  MavenRepository,
  MavenSettings,
} from './types';

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
  return regEx(/\${.*?}/g).test(str);
}

function depFromNode(
  node: XmlElement,
  underBuildSettingsElement = false
): PackageDependency | null {
  if (!('valueWithPath' in node)) {
    return null;
  }
  let groupId = node.valueWithPath('groupId')?.trim();
  const artifactId = node.valueWithPath('artifactId')?.trim();
  const currentValue = node.valueWithPath('version')?.trim();
  let depType: string;

  if (!groupId && node.name === 'plugin') {
    groupId = 'org.apache.maven.plugins';
  }

  if (groupId && artifactId && currentValue) {
    const depName = `${groupId}:${artifactId}`;
    const versionNode = node.descendantWithPath('version');
    const fileReplacePosition = versionNode.position;
    const datasource = datasourceMaven.id;
    const registryUrls = [];
    const result: PackageDependency = {
      datasource,
      depName,
      currentValue,
      fileReplacePosition,
      registryUrls,
    };

    switch (node.name) {
      case 'plugin':
      case 'extension':
        depType = 'build';
        break;
      case 'parent':
        depType = 'parent';
        break;
      case 'dependency':
        if (underBuildSettingsElement) {
          depType = 'build';
        } else {
          depType = node.valueWithPath('scope')?.trim() ?? 'compile'; // maven default scope is compile
        }
        break;
    }

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
  isRoot = true,
  underBuildSettingsElement = false
): PackageDependency[] {
  const dep = depFromNode(node, underBuildSettingsElement);
  if (dep && !isRoot) {
    result.push(dep);
  }
  if (node.children) {
    for (const child of node.children) {
      deepExtract(
        child as XmlElement,
        result,
        false,
        node.name === 'build' ||
          node.name === 'reporting' ||
          underBuildSettingsElement
      );
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
    str.replace(regEx(/\${.*?}/g), (substr) => {
      const propKey = substr.slice(2, -1).trim();
      const propValue = props[propKey];
      return propValue ? propValue.val : substr;
    });

  const depName = replaceAll(dep.depName);
  const registryUrls = dep.registryUrls.map((url) => replaceAll(url));

  let fileReplacePosition = dep.fileReplacePosition;
  let propSource = null;
  let groupName = null;
  const currentValue = dep.currentValue.replace(
    regEx(/^\${.*?}$/),
    (substr) => {
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
    }
  );

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
  }

  if (propSource && depPackageFile !== propSource) {
    result.editFile = propSource;
  }

  return result;
}

function resolveParentFile(packageFile: string, parentPath: string): string {
  let parentFile = 'pom.xml';
  let parentDir = parentPath;
  const parentBasename = upath.basename(parentPath);
  if (parentBasename === 'pom.xml' || parentBasename.endsWith('.pom.xml')) {
    parentFile = parentBasename;
    parentDir = upath.dirname(parentPath);
  }
  const dir = upath.dirname(packageFile);
  return upath.normalize(upath.join(dir, parentDir, parentFile));
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
      const repoUrl = repo.valueWithPath('url')?.trim();
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
      project.valueWithPath('parent.relativePath')?.trim() || '../pom.xml';
    result.parent = resolveParentFile(packageFile, parentPath);
  }

  return result;
}

export function extractSettings(rawContent: string): MavenSettings {
  if (!rawContent) {
    return {
      mirrors: [],
      repositories: [],
    };
  }

  const settings = parseSettings(rawContent);
  if (!settings) {
    return {
      mirrors: [],
      repositories: [],
    };
  }

  const mirrors = parseMirrors(settings, 'mirrors');
  const repositories: MavenRepository[] = [];

  settings.childNamed('profiles')?.eachChild((profile) => {
    const repositoryUrls = parseRepositories(profile, 'repositories');
    repositories.push(...repositoryUrls);
  });

  return {
    mirrors,
    repositories,
  };
}

function parseMirrors(xmlNode: XmlElement, path: string): MavenMirror[] {
  const children = xmlNode.descendantWithPath(path);
  const mirrors = [];
  if (children?.children) {
    children.eachChild((child) => {
      const url = child.valueWithPath('url');
      const id = child.valueWithPath('id');
      const mirrorOf = child.valueWithPath('mirrorOf');
      if (url && id && mirrorOf) {
        mirrors.push({
          id,
          url,
          mirrorOf,
        });
      }
    });
  }
  return mirrors;
}

function parseRepositories(
  xmlNode: XmlElement,
  path: string
): MavenRepository[] {
  const children = xmlNode.descendantWithPath(path);
  const repositories = [];
  if (children?.children) {
    children.eachChild((child) => {
      const url = child.valueWithPath('url');
      const id = child.valueWithPath('id');
      if (url && id) {
        repositories.push({
          id,
          url,
        });
      }
    });
  }
  return repositories;
}

export function parseSettings(raw: string): XmlDocument | null {
  let settings: XmlDocument;
  try {
    settings = new XmlDocument(raw);
  } catch (e) {
    return null;
  }
  const { name, attr } = settings;
  if (name !== 'settings') {
    return null;
  }
  if (attr.xmlns === 'http://maven.apache.org/SETTINGS/1.0.0') {
    return settings;
  }
  return null;
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
      rawDep.registryUrls = [...urlsSet];
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
    delete packageFile.mavenProps;
    packageFile.deps.forEach((dep) => {
      delete dep.propSource;
    });
  });
  return packageFiles;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[]> {
  const packages: PackageFile[] = [];

  const mirrors = [];
  const repositories: MavenRepository[] = [
    {
      id: 'central',
      url: MAVEN_REPO,
    },
  ];

  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.trace({ packageFile }, 'packageFile has no content');
      continue;
    }
    if (packageFile.endsWith('settings.xml')) {
      const settings = extractSettings(content);
      if (settings.mirrors || settings.repositories) {
        logger.debug(
          { registries: settings, packageFile },
          'Found registries in settings.xml'
        );
        mirrors.push(...settings.mirrors);
        repositories.push(...settings.repositories);
      }
    } else {
      const pkg = extractPackage(content, packageFile);
      if (pkg) {
        packages.push(pkg);
      } else {
        logger.trace({ packageFile }, 'can not read dependencies');
      }
    }
  }
  // merge repos and mirrors
  const mergedRegistries = mergeReposAndMirrors(mirrors, repositories);

  if (mergedRegistries) {
    for (const pkgFile of packages) {
      for (const dep of pkgFile.deps) {
        /* istanbul ignore else */
        if (dep.registryUrls) {
          dep.registryUrls.push(...mergedRegistries);
        } else {
          dep.registryUrls = [...mergedRegistries];
        }
      }
    }
  }
  return cleanResult(resolveParents(packages));
}

export function mergeReposAndMirrors(
  mirrors: MavenMirror[],
  repositories: MavenRepository[]
): string[] {
  // loop through each repository
  const mergedRepositories: string[] = [];
  for (const repo of repositories) {
    const matchedMirror = getMirrorMatch(mirrors, repo);
    if (matchedMirror) {
      mergedRepositories.push(matchedMirror.url);
    } else {
      mergedRepositories.push(repo.url);
    }
  }
  // unique urls
  return [...new Set(mergedRepositories)];
}

export function getMirrorMatch(
  mirrors: MavenMirror[],
  repo: MavenRepository
): MavenMirror | undefined {
  // we support only:
  // *                      (all)
  // repo1                  (direct)
  // repo1, repo2           (multiple direct)
  // *,!repo2 | !repo2,*    (all, except)
  for (const mirror of mirrors) {
    if (mirror.mirrorOf === '*') {
      // match all
      return mirror;
    }
    const matches = mirror.mirrorOf.split(',');
    if (matches.includes('*') && matches.find((e) => e.startsWith('!'))) {
      for (const match of matches) {
        if (match !== '*' && `!${repo.id}` !== match) {
          return mirror;
        }
      }
    } else if (
      !matches.includes('*') &&
      !matches.find((e) => e.startsWith('!'))
    ) {
      // match directly (as well as multiple)
      for (const match of matches) {
        if (repo.id === match) {
          return mirror;
        }
      }
    }
  }
  return undefined;
}
