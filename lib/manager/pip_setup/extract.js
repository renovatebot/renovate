const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const { join } = require('upath');
const { isSkipComment } = require('../../util/ignore');
const { dependencyPattern } = require('../pip_requirements/extract');

module.exports = {
  extractPackageFile,
  extractSetupFile,
};

async function extractSetupFile(content, packageFile, config) {
  const cwd = config.localDir;
  // extract.py needs setup.py to be written to disk
  if (!config.gitFs) {
    const localFileName = join(config.localDir, packageFile);
    await fs.outputFile(localFileName, content);
  }
  let cmd;
  const args = [join(__dirname, 'extract.py'), packageFile];
  // istanbul ignore if
  if (config.binarySource === 'docker') {
    logger.info('Running python via docker');
    cmd = 'docker';
    args.unshift(
      'run',
      '-i',
      '--rm',
      // volume
      '-v',
      `${cwd}:${cwd}`,
      '-v',
      `${__dirname}:${__dirname}`,
      // cwd
      '-w',
      cwd,
      // image
      'renovate/pip',
      'python'
    );
  } else {
    logger.info('Running python via global command');
    cmd = 'python';
  }
  logger.debug({ cmd, args }, 'python command');

  const { stdout, stderr } = await exec(`${cmd} ${args.join(' ')}`, {
    cwd,
    shell: true,
    timeout: 5000,
  });
  // istanbul ignore if
  if (stderr) {
    logger.warn({ stdout, stderr }, 'Error in read setup file');
  }
  return JSON.parse(stdout);
}

async function extractPackageFile(content, packageFile, config) {
  logger.debug('pip_setup.extractPackageFile()');
  let setup;
  try {
    setup = await extractSetupFile(content, packageFile, config);
  } catch (err) {
    logger.warn({ err }, 'Failed to read setup file');
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
      };
      return dep;
    })
    .filter(Boolean);
  if (!deps.length) {
    return null;
  }
  return { deps };
}
