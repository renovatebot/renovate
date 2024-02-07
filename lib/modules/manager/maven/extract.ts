import is from '@sindresorhus/is';
import upath from 'upath';
import { XmlDocument, XmlElement } from 'xmldoc';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { MavenDatasource } from '../../datasource/maven';
import { MAVEN_REPO } from '../../datasource/maven/common';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { MavenProp } from './types';

function parsePom(raw: string, packageFile: string): XmlDocument | null {
  let project: XmlDocument;
  try {
    project = new XmlDocument(raw);
  } catch (err) {
    logger.debug({ packageFile }, `Failed to parse as XML`);
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

function containsPlaceholder(str: string | null | undefined): boolean {
  return !!str && regEx(/\${[^}]*?}/).test(str);
}

function depFromNode(
  node: XmlElement,
  underBuildSettingsElement: boolean,
): PackageDependency | null {
  if (!('valueWithPath' in node)) {
    return null;
  }
  let groupId = node.valueWithPath('groupId')?.trim();
  const artifactId = node.valueWithPath('artifactId')?.trim();
  const currentValue = node.valueWithPath('version')?.trim();
  let depType: string | undefined;

  if (!groupId && node.name === 'plugin') {
    groupId = 'org.apache.maven.plugins';
  }

  if (groupId && artifactId && currentValue) {
    const depName = `${groupId}:${artifactId}`;
    const versionNode = node.descendantWithPath('version')!;
    const fileReplacePosition = versionNode.position;
    const datasource = MavenDatasource.id;
    const registryUrls = [MAVEN_REPO];
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
        } else if (node.valueWithPath('optional')?.trim() === 'true') {
          depType = 'optional';
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
  underBuildSettingsElement = false,
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
          underBuildSettingsElement,
      );
    }
  }
  return result;
}

function applyProps(
  dep: PackageDependency<Record<string, any>>,
  depPackageFile: string,
  props: MavenProp,
): PackageDependency<Record<string, any>> {
  let result = dep;
  let anyChange = false;
  const alreadySeenProps: Set<string> = new Set();

  do {
    const [returnedResult, returnedAnyChange, fatal] = applyPropsInternal(
      result,
      depPackageFile,
      props,
      alreadySeenProps,
    );
    if (fatal) {
      dep.skipReason = 'recursive-placeholder';
      return dep;
    }
    result = returnedResult;
    anyChange = returnedAnyChange;
  } while (anyChange);

  if (containsPlaceholder(result.depName)) {
    result.skipReason = 'name-placeholder';
  } else if (containsPlaceholder(result.currentValue)) {
    result.skipReason = 'version-placeholder';
  }

  return result;
}

function applyPropsInternal(
  dep: PackageDependency<Record<string, any>>,
  depPackageFile: string,
  props: MavenProp,
  previouslySeenProps: Set<string>,
): [PackageDependency<Record<string, any>>, boolean, boolean] {
  let anyChange = false;
  let fatal = false;

  const seenProps: Set<string> = new Set();

  const replaceAll = (str: string): string =>
    str.replace(regEx(/\${[^}]*?}/g), (substr) => {
      const propKey = substr.slice(2, -1).trim();
      // TODO: wrong types here, props is already `MavenProp`
      const propValue = (props as any)[propKey] as MavenProp;
      if (propValue) {
        anyChange = true;
        if (previouslySeenProps.has(propKey)) {
          fatal = true;
        } else {
          seenProps.add(propKey);
        }
        return propValue.val;
      }
      return substr;
    });

  const depName = replaceAll(dep.depName!);
  const registryUrls = dep.registryUrls!.map((url) => replaceAll(url));

  let fileReplacePosition = dep.fileReplacePosition;
  let propSource = dep.propSource;
  let groupName: string | null = null;
  const currentValue = dep.currentValue!.replace(
    regEx(/^\${[^}]*?}$/),
    (substr) => {
      const propKey = substr.slice(2, -1).trim();
      // TODO: wrong types here, props is already `MavenProp`
      const propValue = (props as any)[propKey] as MavenProp;
      if (propValue) {
        if (!groupName) {
          groupName = propKey;
        }
        fileReplacePosition = propValue.fileReplacePosition;
        propSource =
          propValue.packageFile ??
          // istanbul ignore next
          undefined;
        anyChange = true;
        if (previouslySeenProps.has(propKey)) {
          fatal = true;
        } else {
          seenProps.add(propKey);
        }
        return propValue.val;
      }
      return substr;
    },
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

  if (propSource && depPackageFile !== propSource) {
    result.editFile = propSource;
  }

  for (const prop of seenProps) {
    previouslySeenProps.add(prop);
  }
  return [result, anyChange, fatal];
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

interface MavenInterimPackageFile extends PackageFile {
  mavenProps?: Record<string, any>;
  parent?: string;
}

export function extractPackage(
  rawContent: string,
  packageFile: string,
): PackageFile | null {
  if (!rawContent) {
    return null;
  }

  const project = parsePom(rawContent, packageFile);
  if (!project) {
    return null;
  }

  const result: MavenInterimPackageFile = {
    datasource: MavenDatasource.id,
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
    const repoUrls: string[] = [];
    for (const repo of repositories.childrenNamed('repository')) {
      const repoUrl = repo.valueWithPath('url')?.trim();
      if (repoUrl) {
        repoUrls.push(repoUrl);
      }
    }
    result.deps.forEach((dep) => {
      if (is.array(dep.registryUrls)) {
        repoUrls.forEach((url) => dep.registryUrls!.push(url));
      }
    });
  }

  if (packageFile && project.childNamed('parent')) {
    const parentPath =
      project.valueWithPath('parent.relativePath')?.trim() ?? '../pom.xml';
    result.parent = resolveParentFile(packageFile, parentPath);
  }

  if (project.childNamed('version')) {
    result.packageFileVersion = project.valueWithPath('version')!.trim();
  }

  return result;
}

export function extractRegistries(rawContent: string): string[] {
  if (!rawContent) {
    return [];
  }

  const settings = parseSettings(rawContent);
  if (!settings) {
    return [];
  }

  const urls: string[] = [];

  const mirrorUrls = parseUrls(settings, 'mirrors');
  urls.push(...mirrorUrls);

  settings.childNamed('profiles')?.eachChild((profile) => {
    const repositoryUrls = parseUrls(profile, 'repositories');
    urls.push(...repositoryUrls);
  });

  // filter out duplicates
  return [...new Set(urls)];
}

function parseUrls(xmlNode: XmlElement, path: string): string[] {
  const children = xmlNode.descendantWithPath(path);
  const urls: string[] = [];
  if (children?.children) {
    children.eachChild((child) => {
      const url = child.valueWithPath('url');
      if (url) {
        urls.push(url);
      }
    });
  }
  return urls;
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
  const extractedPackages: Record<string, MavenInterimPackageFile> = {};
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
    let pkg: MavenInterimPackageFile | null = extractedPackages[name];
    while (pkg) {
      propsHierarchy.unshift(pkg.mavenProps!);

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
      const urlsSet = new Set([...rawDep.registryUrls!, ...registryUrls[name]]);
      rawDep.registryUrls = [...urlsSet];
    });
  });

  const rootDeps = new Set<string>();
  // Resolve placeholders
  packageFileNames.forEach((name) => {
    const pkg = extractedPackages[name];
    pkg.deps.forEach((rawDep) => {
      const dep = applyProps(rawDep, name, extractedProps[name]);
      if (dep.depType === 'parent') {
        const parentPkg = extractedPackages[pkg.parent!];
        if (parentPkg && !parentPkg.parent) {
          rootDeps.add(dep.depName!);
        }
      }
      const sourceName = dep.propSource ?? name;
      extractedDeps[sourceName].push(dep);
    });
  });

  const packageFiles = packageFileNames.map((packageFile) => {
    const pkg = extractedPackages[packageFile];
    const deps = extractedDeps[packageFile];
    for (const dep of deps) {
      if (rootDeps.has(dep.depName!)) {
        dep.depType = 'parent-root';
      }
    }
    return { ...pkg, deps };
  });

  return packageFiles;
}

function cleanResult(packageFiles: MavenInterimPackageFile[]): PackageFile[] {
  packageFiles.forEach((packageFile) => {
    delete packageFile.mavenProps;
    delete packageFile.parent;
    packageFile.deps.forEach((dep) => {
      delete dep.propSource;
    });
  });
  return packageFiles;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[]> {
  const packages: PackageFile[] = [];
  const additionalRegistryUrls: string[] = [];

  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.debug({ packageFile }, 'packageFile has no content');
      continue;
    }
    if (packageFile.endsWith('settings.xml')) {
      const registries = extractRegistries(content);
      if (registries) {
        logger.debug(
          { registries, packageFile },
          'Found registryUrls in settings.xml',
        );
        additionalRegistryUrls.push(...registries);
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
  if (additionalRegistryUrls) {
    for (const pkgFile of packages) {
      for (const dep of pkgFile.deps) {
        /* istanbul ignore else */
        if (dep.registryUrls) {
          dep.registryUrls.push(...additionalRegistryUrls);
        } else {
          dep.registryUrls = [...additionalRegistryUrls];
        }
      }
    }
  }
  return cleanResult(resolveParents(packages));
}
