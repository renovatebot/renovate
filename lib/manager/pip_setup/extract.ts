import { join } from 'upath';
import { exec } from '../../util/exec';
import { logger } from '../../logger';
import { isSkipComment } from '../../util/ignore';
import { dependencyPattern } from '../pip_requirements/extract';
import { ExtractConfig, PackageFile, PackageDependency } from '../common';

export const pythonVersions = ['python', 'python3', 'python3.8'];
let pythonAlias: string | null = null;

// istanbul ignore next
export function resetModule(): void {
  pythonAlias = null;
}

export function parsePythonVersion(str: string): number[] {
  const arr = str.split(' ')[1].split('.');
  return [parseInt(arr[0], 10), parseInt(arr[1], 10)];
}

export async function getPythonAlias(): Promise<string> {
  // istanbul ignore if
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
interface PythonSetup {
  extras_require: string[];
  install_requires: string[];
}
export async function extractSetupFile(
  _content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PythonSetup> {
  const cwd = config.localDir;
  let cmd: string;
  const args = [`"${join(__dirname, 'extract.py')}"`, `"${packageFile}"`];
  if (config.binarySource === 'docker') {
    logger.info('Running python via docker');
    await exec(`docker pull renovate/pip`);
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
    timeout: 5000,
  });
  // istanbul ignore if
  if (res.stderr) {
    const stderr = res.stderr.replace(/.*\n\s*import imp/, '').trim();
    if (stderr.length) {
      logger.warn(
        { stdout: res.stdout, stderr: res.stderr },
        'Error in read setup file'
      );
    }
  }
  return JSON.parse(res.stdout);
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PackageFile | null> {
  logger.debug('pip_setup.extractPackageFile()');
  let setup: PythonSetup;
  try {
    setup = await extractSetupFile(content, packageFile, config);
  } catch (err) {
    logger.warn({ err, content, packageFile }, 'Failed to read setup.py file');
    return null;
  }
  const requires: string[] = [];
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
      let dep: PackageDependency = {};
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
        managerData: { lineNumber },
        datasource: 'pypi',
      };
      return dep;
    })
    .filter(Boolean)
    .sort((a, b) =>
      a.managerData.lineNumber === b.managerData.lineNumber
        ? a.depName.localeCompare(b.depName)
        : a.managerData.lineNumber - b.managerData.lineNumber
    );
  // istanbul ignore if
  if (!deps.length) {
    return null;
  }
  return { deps };
}
