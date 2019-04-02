const yaml = require('js-yaml');
const npm = require('../../versioning/npm/index');

function getDeps(depsObj, preset = {}) {
  if (!depsObj) return [];
  return Object.keys(depsObj).reduce((acc, depName) => {
    if (depName === 'meta') return acc;

    const section = depsObj[depName];
    let currentValue = null;

    if (section && npm.isValid(section.toString())) {
      currentValue = section.toString();
    }

    if (section.version && npm.isValid(section.version.toString())) {
      currentValue = section.version.toString();
    }

    const dep = { ...preset, depName, currentValue };
    if (!currentValue) {
      dep.skipReason = 'not-a-version';
    }

    return [...acc, dep];
  }, []);
}

function extractPackageFile(content, packageFile) {
  try {
    const doc = yaml.safeLoad(content);
    const deps = [
      ...getDeps(doc.dependencies, {
        depType: 'dependencies',
      }),
      ...getDeps(doc.dev_dependencies, {
        depType: 'dev_dependencies',
      }),
    ];

    if (deps.length) {
      return {
        packageFile,
        manager: 'pub',
        datasource: 'dart',
        deps,
      };
    }
  } catch (e) {
    logger.info({ packageFile }, 'Can not parse dependency');
  }
  return null;
}

function updateDependency(fileContent, upgrade) {
  const { depName, depType, currentValue, newValue } = upgrade;

  if (currentValue === newValue) return fileContent;

  const sectionBeginRegExp = new RegExp(`^${depType}:`);
  const isSectionBegin = line => sectionBeginRegExp.test(line);
  const isSectionEnd = line => /^[^\s]/.test(line);

  const simpleDepRegExp = new RegExp(`^\\s+${depName}:\\s*[^\\s]+\\s*$`);
  const isOneLineDep = line => simpleDepRegExp.test(line);

  const multilineDepRegExp = new RegExp(`^\\s+${depName}:\\s*$`);
  const isMultilineDepRegExp = line => multilineDepRegExp.test(line);

  const versionRegExp = new RegExp('^\\s+version:\\s*[^\\s]+\\s*$');
  const isVersionLine = line => versionRegExp.test(line);

  const isValidVersion = line => {
    const version = yaml.load(line.replace(/^.*:\s*/, '')).toString();
    return version === currentValue;
  };

  let isSection = false;
  let indent = null;

  const lines = fileContent.split('\n');
  const len = lines.length;
  for (let idx = 0; idx < len; idx += 1) {
    const line = lines[idx];

    if (isSectionBegin(line)) {
      isSection = true;
    } else if (isSectionEnd(line)) {
      isSection = false;
    } else if (isSection) {
      if (isOneLineDep(line)) {
        if (!isValidVersion(line)) return null;
        lines[idx] = line.replace(currentValue, newValue);
        break;
      } else if (isMultilineDepRegExp(line)) {
        indent = line.search(/[^\s]/);
      } else if (indent) {
        const currentIndent = line.search(/[^\s]/);
        if (currentIndent <= indent) {
          indent = null;
        } else if (isVersionLine(line)) {
          if (!isValidVersion(line)) return null;
          lines[idx] = line.replace(currentValue, newValue);
          break;
        }
      }
    }
  }

  return lines.join('\n');
}

module.exports = {
  extractPackageFile,
  updateDependency,
};
