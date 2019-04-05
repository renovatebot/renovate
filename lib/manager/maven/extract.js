const path = require('path');
const { XmlDocument } = require('xmldoc');
const { isVersion } = require('../../versioning/maven');

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
  const depName = dep.depName.replace(/\${.*?}/g, substr => {
    const propKey = substr.slice(2, -1).trim();
    const propValue = props[propKey];
    return propValue ? propValue.val : substr;
  });

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
    currentValue,
    fileReplacePosition,
    propSource,
  };

  if (containsPlaceholder(depName)) {
    result.skipReason = 'name-placeholder';
  } else if (containsPlaceholder(currentValue)) {
    result.skipReason = 'version-placeholder';
  } else if (!isVersion(currentValue)) {
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

function extractDependencies(raw, packageFile) {
  if (!raw) return null;

  const project = parsePom(raw);
  if (!project) return null;

  const result = {
    datasource: 'maven',
    manager: 'maven',
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

async function extractAllPackageFiles(config, packageFiles) {
  const names = [];
  const packages = {};
  const deps = {};
  const props = {};

  for (const packageFile of packageFiles) {
    const content = await platform.getFile(packageFile);
    if (content) {
      const pkg = extractDependencies(content, packageFile);
      if (pkg) {
        names.push(packageFile);
        deps[packageFile] = [];
        packages[packageFile] = pkg;
      } else {
        logger.info({ packageFile }, 'can not read dependencies');
      }
    } else {
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }

  // Construct package-specific prop scopes
  names.forEach(name => {
    const propsChain = [];
    let pkg = packages[name];
    while (pkg) {
      propsChain.unshift(pkg.mavenProps);
      pkg = packages[pkg.parent];
    }
    propsChain.unshift({});
    props[name] = Object.assign.apply(null, propsChain);
  });

  // Resolve placeholders
  names.forEach(name => {
    const file = packages[name];
    file.deps.forEach(rawDep => {
      const dep = applyProps(rawDep, props[name]);
      const sourceName = dep.propSource || name;
      deps[sourceName].push(dep);
    });
  });

  return names.map(name => ({
    ...packages[name],
    deps: deps[name],
  }));
}

module.exports = {
  containsPlaceholder,
  parsePom,
  extractDependencies,
  extractAllPackageFiles,
};
