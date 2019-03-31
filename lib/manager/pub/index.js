const yaml = require('js-yaml');
const npm = require('../../versioning/npm/index');

function parseDeps(obj, preset = {}) {
  if (!obj) return [];
  return Object.keys(obj).reduce((acc, depName) => {
    if (depName === 'meta') return acc;

    const section = obj[depName];
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

function extractDependencies(content) {
  try {
    const doc = yaml.safeLoad(content);
    return [
      ...parseDeps(doc.dependencies, {
        depType: 'dependencies',
      }),
      ...parseDeps(doc.dev_dependencies, {
        depType: 'dev_dependencies',
      }),
    ];
  } catch (e) {
    return null;
  }
}

async function extractAllPackageFiles(config, packageFiles) {
  const pubFiles = [];
  for (const packageFile of packageFiles) {
    const content = await platform.getFile(packageFile);
    if (content) {
      const deps = extractDependencies(content);
      if (deps) {
        pubFiles.push({
          packageFile,
          manager: 'pub',
          datasource: 'dart',
          deps,
        });
      } else {
        logger.info({ packageFile }, 'Can not read or parse dependencies');
      }
    } else {
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }
  return pubFiles;
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
  extractAllPackageFiles,
  updateDependency,
};
