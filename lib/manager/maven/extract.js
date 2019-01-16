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
    const depName = `${groupId}/${artifactId}`;
    const result = {
      depName,
      currentValue,
    };
    if (containsPlaceholder(depName)) {
      result.skipReason = 'name-placeholder';
    } else if (containsPlaceholder(currentValue)) {
      result.skipReason = 'version-placeholder';
    } else if (!isVersion(currentValue)) {
      result.skipReason = 'not-a-version';
    } else {
      const versionNode = node.descendantWithPath('version');
      result.fileReplacePosition = versionNode.startTagPosition;
      result.purl = `pkg:maven/${
        result.depName
      }?repository_url=http://repo.maven.apache.org/maven2`;
    }
    return result;
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

  result.deps = deepExtract(project);

  return result;
}

module.exports = {
  parsePom,
  extractDependencies,
};
