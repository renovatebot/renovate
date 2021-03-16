import * as datasourcePypi from '../../datasource/pypi';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { exec } from '../../util/exec';
import { BinarySource } from '../../util/exec/common';
import { isSkipComment } from '../../util/ignore';
import { dependencyPattern } from '../pip_requirements/extract';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { PythonSetup, getExtractFile, parseReport } from './util';

export const pythonVersions = ['python', 'python3', 'python3.8', 'python3.9'];
let pythonAlias: string | null = null;

export function resetModule(): void {
  pythonAlias = null;
}

export function parsePythonVersion(str: string): number[] {
  const arr = str.split(' ')[1].split('.');
  return [parseInt(arr[0], 10), parseInt(arr[1], 10)];
}

export async function getPythonAlias(): Promise<string> {
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
        break;
      }
    } catch (err) {
      logger.debug(`${pythonVersion} alias not found`);
    }
  }
  return pythonAlias;
}

export async function extractSetupFile(
  _content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PythonSetup> {
  let cmd = 'python';
  const extractPy = await getExtractFile();
  const args = [`"${extractPy}"`, `"${packageFile}"`];
  if (config.binarySource !== BinarySource.Docker) {
    logger.debug('Running python via global command');
    cmd = await getPythonAlias();
  }
  logger.debug({ cmd, args }, 'python command');
  const res = await exec(`${cmd} ${args.join(' ')}`, {
    cwdFile: packageFile,
    timeout: 30000,
    docker: {
      image: 'python',
    },
  });
  if (res.stderr) {
    const stderr = res.stderr
      .replace(/.*\n\s*import imp/, '')
      .trim()
      .replace('fatal: No names found, cannot describe anything.', '');
    if (stderr.length) {
      logger.warn({ stdout: res.stdout, stderr }, 'Error in read setup file');
    }
  }
  return parseReport(packageFile);
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
  }
  if (!setup) {
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
    .map((req) => {
      const lineNumber = lines.findIndex((l) => l.includes(req));
      if (lineNumber === -1) {
        return null;
      }
      const rawline = lines[lineNumber];
      let dep: PackageDependency = {};
      const [, comment] = rawline.split('#').map((part) => part.trim());
      if (isSkipComment(comment)) {
        dep.skipReason = SkipReason.Ignored;
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
        datasource: datasourcePypi.id,
      };
      return dep;
    })
    .filter(Boolean)
    .sort((a, b) =>
      a.managerData.lineNumber === b.managerData.lineNumber
        ? a.depName.localeCompare(b.depName)
        : a.managerData.lineNumber - b.managerData.lineNumber
    );
  if (!deps.length) {
    return null;
  }
  return { deps };
}
