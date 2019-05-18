const path = require('path');
const { XmlDocument } = require('xmldoc');
const { isValid } = require('../../versioning/maven');

const DEFAULT_MAVEN_REPO = 'https://repo.maven.apache.org/maven2';

function parsePom(raw) {
  let project;
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

function containsPlaceholder(str) {
  return /\${.*?}/g.test(str);
}

function depFromNode(node) {
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

function deepExtract(node, result = [], isRoot = true) {
  const dep = depFromNode(node);
  if (dep && !isRoot) {
    result.push(dep);
  }
  if (node.children) {
    for (const child of node.children) {
      deepExtract(child, result, false);
    }
  }
  return result;
}

function applyProps(dep, props) {
  const replaceAll = str =>
    str.replace(/\${.*?}/g, substr => {
      const propKey = substr.slice(2, -1).trim();
      const propValue = props[propKey];
      return propValue ? propValue.val : substr;
    });

  const depName = replaceAll(dep.depName);
  const registryUrls = dep.registryUrls.map(url => replaceAll(url));

  let fileReplacePosition = dep.fileReplacePosition;
  let propSource = null;
  const currentValue = dep.currentValue.replace(/^\${.*?}$/, substr => {
    const propKey = substr.slice(2, -1).trim();
    const propValue = props[propKey];
    if (propValue) {
      fileReplacePosition = propValue.fileReplacePosition;
      propSource = propValue.packageFile;
      return propValue.val;
    }
    return substr;
  });

  const result = {
    ...dep,
    depName,
    registryUrls,
    fileReplacePosition,
    propSource,
    currentValue,
  };

  if (containsPlaceholder(depName)) {
    result.skipReason = 'name-placeholder';
  } else if (containsPlaceholder(currentValue)) {
    result.skipReason = 'version-placeholder';
  } else if (!isValid(currentValue)) {
    result.skipReason = 'not-a-version';
  }

  return result;
}

function resolveParentFile(packageFile, parentPath) {
  let parentFile = 'pom.xml';
  let parentDir = parentPath;
  const parentBasename = path.basename(parentPath);
  if (parentBasename === 'pom.xml' || /\.pom\.xml$/.test(parentBasename)) {
    parentFile = parentBasename;
    parentDir = path.dirname(parentPath);
  }
  const dir = path.dirname(packageFile);
  return path.normalize(path.join(dir, parentDir, parentFile));
}

function extractPackage(rawContent, packageFile = null) {
  if (!rawContent) return null;

  const project = parsePom(rawContent);
  if (!project) return null;

  const result = {
    datasource: 'maven',
    packageFile,
  };

  result.deps = deepExtract(project);

  const propsNode = project.childNamed('properties');
  const props = {};
  if (propsNode && propsNode.children) {
    for (const propNode of propsNode.children) {
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

  const parentPath = project.valueWithPath('parent.relativePath');
  if (parentPath) {
    result.parent = resolveParentFile(packageFile, parentPath);
  }

  return result;
}

function resolveProps(packages) {
  const packageFileNames = [];
  const extractedPackages = {};
  const extractedDeps = {};
  const extractedProps = {};
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
    const hierarchy = [];
    let pkg = extractedPackages[name];
    while (pkg) {
      hierarchy.unshift(pkg.mavenProps);
      pkg = extractedPackages[pkg.parent];
    }
    hierarchy.unshift({});
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

async function extractAllPackageFiles(config, packageFiles) {
  const packages = [];
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

  return resolveProps(packages);
}

module.exports = {
  containsPlaceholder,
  parsePom,
  extractPackage,
  resolveProps,
  extractAllPackageFiles,
  DEFAULT_MAVEN_REPO,
};
