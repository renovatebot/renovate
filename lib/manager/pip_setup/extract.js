const { execSync } = require('child_process');
const fs = require('fs-extra');
const { join } = require('upath');
const {
  dependencyPattern,
  isSkipComment,
} = require('../pip_requirements/extract');

module.exports = {
  extractPackageFile,
  extractSetupFile,
};

function extractSetupFile(content, packageFile, config) {
  let cmd;
  const cwd = config.localDir;
  // extract.py needs setup.py to be written to disk
  if (!config.gitFs) {
    const localFileName = join(config.localDir, packageFile);
    fs.outputFileSync(localFileName, content);
  }
  // istanbul ignore if
  if (config.binarySource === 'docker') {
    logger.info('Running python via docker');
    cmd = `docker run --rm `;
    const volumes = [cwd];
    cmd += volumes.map(v => `-v ${v}:${v} `).join('');
    cmd += `-w ${cwd} `;
    cmd += `renovate/python python`;
  } else {
    logger.info('Running python via global command');
    cmd = 'python';
  }
  const args = `- "${packageFile}"`;
  logger.debug({ cmd, args }, 'python command');
  try {
    const output = execSync(`${cmd} ${args}`, {
      cwd,
      input: fs.readFileSync(join(__dirname, 'extract.py')),
      shell: true,
      encoding: 'utf8',
      timeout: 1000,
    });
    return JSON.parse(output);
  } catch (err) {
    logger.warn({ err }, 'Failed to read setup file');
    return null;
  }
}

function extractPackageFile(content, packageFile, config) {
  logger.debug('pip_setup.extractPackageFile()');
  const setup = extractSetupFile(content, packageFile, config);
  if (!setup) {
    return null;
  }
  const requires = [];
  if (setup.install_requires) {
    requires.push(...setup.install_requires);
  }
  if (setup.extras_require) {
    for (const req of Object.values(setup.extras_require)) {
      requires.push(...req);
    }
  }
  const regex = new RegExp(`^${dependencyPattern}`);
  const lines = content.split('\n');
  const deps = requires
    .map(req => {
      const lineNumber = lines.findIndex(l => l.includes(req));
      if (lineNumber === -1) {
        return null;
      }
      const rawline = lines[lineNumber];
      let dep = {};
      const [, comment] = rawline.split('#').map(part => part.trim());
      if (isSkipComment(comment)) {
        dep.skipReason = 'ignored';
      }
      regex.lastIndex = 0;
      const matches = regex.exec(req);
      if (!matches) {
        return null;
      }
      const [, depName, , currentValue] = matches;
      dep = {
        ...dep,
        depName,
        currentValue,
        lineNumber,
        purl: 'pkg:pypi/' + depName,
        versionScheme: 'pep440',
      };
      return dep;
    })
    .filter(Boolean);
  if (!deps.length) {
    return null;
  }
  return { deps };
}
