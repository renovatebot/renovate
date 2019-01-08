const xmlParser = require('fast-xml-parser');
const { isVersion } = require('../../versioning/maven');

function parsePom(raw) {
  if (!xmlParser.validate(raw)) return null;
  const xml = xmlParser.parse(raw, {
    ignoreAttributes: false,
    parseTrueNumberOnly: false,
  });
  if (!xml) return false;
  const project = xml.project;
  if (!project) return false;
  const ns = project['@_xmlns'];
  if (!ns) return false;
  if (ns !== 'http://maven.apache.org/POM/4.0.0') return false;
  return project;
}

function containsPlaceholder(str) {
  return /\${.*?}/g.test(str);
}

function extractFromNode(node, mavenXmlPath) {
  if (node.version) {
    const groupId = node.groupId || null;
    const artifactId = node.artifactId || null;
    const depName = `${groupId}:${artifactId}`;
    const currentValue = node.version ? node.version.toString() : null;
    const result = {
      depName,
      currentValue,
      mavenXmlPath,
    };
    if (!groupId || !artifactId) {
      result.skipReason = 'name-incomplete';
    } else if (containsPlaceholder(depName)) {
      result.skipReason = 'name-placeholder';
    } else if (containsPlaceholder(currentValue)) {
      result.skipReason = 'version-placeholder';
    } else if (!isVersion(currentValue)) {
      result.skipReason = 'not-a-version';
    }
    return result;
  }
  return null;
}

function pathElemFor(child) {
  const { id, groupId, artifactId } = child;

  if (id) {
    return { id };
  }

  if (groupId && artifactId) {
    return { groupId, artifactId };
  }

  return null;
}

function deepExtract(node, path = [], result = [], isRoot = true) {
  if (Array.isArray(node)) {
    node.forEach(child => {
      const pathElem = pathElemFor(child);
      if (pathElem) {
        deepExtract(child, path.concat(pathElem), result, false);
      }
    });
  } else if (node !== null && typeof node === 'object') {
    const dep = extractFromNode(node, path);
    if (dep && !isRoot) {
      result.push(dep);
    }
    for (const [tag, child] of Object.entries(node)) {
      const pathElem = pathElemFor(child) || tag;
      deepExtract(child, path.concat(pathElem), result, false);
    }
  }
  return result;
}

function extractDependencies(raw) {
  if (!raw) return null;

  const project = parsePom(raw);
  if (!project) return null;

  const result = { datasource: 'maven' };

  const homepage = project.url;
  if (homepage && !containsPlaceholder(homepage)) {
    result.homepage = homepage;
  }

  if (project.scm) {
    const sourceUrl = project.scm.url;
    if (sourceUrl && !containsPlaceholder(sourceUrl)) {
      result.sourceUrl = sourceUrl;
    }
  }

  if (project.issueManagement) {
    const changelogUrl = project.issueManagement.url;
    if (changelogUrl && !containsPlaceholder(changelogUrl)) {
      result.changelogUrl = changelogUrl;
    }
  }

  result.deps = deepExtract(project);

  return result;
}

module.exports = {
  extractDependencies,
};
