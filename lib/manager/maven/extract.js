const { XmlDocument } = require('xmldoc');
const { isVersion } = require('../../versioning/maven');

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
    const registryUrls = ['https://repo.maven.apache.org/maven2'];
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
  const currentValue = dep.currentValue.replace(/^\${.*?}$/, substr => {
    const propKey = substr.slice(2, -1).trim();
    const propValue = props[propKey];
    if (propValue) {
      fileReplacePosition = propValue.fileReplacePosition;
      return propValue.val;
    }
    return substr;
  });

  const result = {
    ...dep,
    depName,
    currentValue,
    fileReplacePosition,
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

function extractDependencies(raw) {
  if (!raw) return null;

  const project = parsePom(raw);
  if (!project) return null;

  const result = { datasource: 'maven' };

  const homepage = project.valueWithPath('url');
  if (homepage && !containsPlaceholder(homepage)) {
    result.homepage = homepage;
  }

  const sourceUrl = project.valueWithPath('scm.url');
  if (sourceUrl && !containsPlaceholder(sourceUrl)) {
    result.sourceUrl = sourceUrl;
  }

  const propsNode = project.childNamed('properties');
  const props = {};
  if (propsNode && propsNode.children) {
    for (const propNode of propsNode.children) {
      const key = propNode.name;
      const val = propNode.val && propNode.val.trim();
      if (key && val) {
        const fileReplacePosition = propNode.position;
        const usageCount = 0;
        props[key] = { val, fileReplacePosition, usageCount };
      }
    }
  }

  const withProps = dep => applyProps(dep, props);
  result.deps = deepExtract(project).map(withProps);

  return result;
}

module.exports = {
  containsPlaceholder,
  parsePom,
  extractDependencies,
};
