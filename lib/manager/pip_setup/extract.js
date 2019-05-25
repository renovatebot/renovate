const { exec } = require('child-process-promise');
const { join } = require('upath');
const { isSkipComment } = require('../../util/ignore');
const { dependencyPattern } = require('../pip_requirements/extract');

const pythonVersions = ['python', 'python3', 'python3.7'];
let pythonAlias = null;
module.exports = {
  extractPackageFile,
  extractSetupFile,
  parsePythonVersion,
  getPythonAlias,
  pythonVersions,
};

function parsePythonVersion(str) {
  const arr = str.split(' ')[1].split('.');
  return [parseInt(arr[0], 10), parseInt(arr[1], 10)];
}

async function getPythonAlias() {
  if (pythonAlias) {
    return pythonAlias;
  }
  pythonAlias = pythonVersions[0]; // fallback to 'python'
  for (const pythonVersion of pythonVersions) {
    try {
      const { stdout, stderr } = await exec(`${pythonVersion} --version`);
      const version = parsePythonVersion(stdout || stderr);
      if (version[0] >= 3 && version[1] >= 7) {
        pythonAlias = pythonVersion;
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug(`${pythonVersion} alias not found`);
    }
  }
  return pythonAlias;
}

async function extractSetupFile(content, packageFile, config) {
  const cwd = config.localDir;
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
    cmd = await getPythonAlias();
  }
  logger.debug({ cmd, args }, 'python command');
  const res = await exec(`${cmd} ${args.join(' ')}`, {
    cwd,
    shell: true,
    timeout: 5000,
  });
  if (res.stderr) {
    const stderr = res.stderr.replace(/.*\n\s*import imp/, '').trim();
    // istanbul ignore if
    if (stderr.length) {
      logger.warn(
        { stdout: res.stdout, stderr: res.stderr },
        'Error in read setup file'
      );
    }
  }
  return JSON.parse(res.stdout);
}

async function extractPackageFile(content, packageFile, config) {
  logger.debug('pip_setup.extractPackageFile()');
  let setup;
  try {
    setup = await extractSetupFile(content, packageFile, config);
  } catch (err) {
    logger.warn({ err, content, packageFile }, 'Failed to read setup.py file');
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
        datasource: 'pypi',
      };
      return dep;
    })
    .filter(Boolean)
    .sort((a, b) =>
      a.lineNumber === b.lineNumber
        ? (a.depName > b.depName) - (a.depName < b.depName)
        : a.lineNumber - b.lineNumber
    );
  // istanbul ignore if
  if (!deps.length) {
    return null;
  }
  return { deps };
}
