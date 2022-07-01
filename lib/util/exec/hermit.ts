import os from 'os';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { localPathExists } from '../fs';
import { rawExec } from './common';
import type { RawExecOptions } from './types';

export function isHermit(): boolean {
  const { binarySource } = GlobalConfig.get();
  return binarySource === 'hermit';
}

async function hermitExists(parts: string[]): Promise<boolean> {
  const hermitForCwd = upath.join(...[...parts, 'bin', 'hermit']);
  logger.trace({ hermitForCwd }, 'looking up hermit');
  return await localPathExists(hermitForCwd);
}

export async function findHermitCwd(cwd: string): Promise<string> {
  const defaultCwd = GlobalConfig.get('localDir') ?? '';
  const parts = cwd.replace(defaultCwd, '').split(upath.sep);
  let exists = false;

  // search the current relative path until reach the defaultCwd
  do {
    exists = await hermitExists(parts);
  } while (!exists && parts.pop() !== undefined);

  if (exists === false) {
    throw new Error(`hermit not found for ${cwd}`);
  }

  // once the path is found, return ${[path}/bin
  // so that hermit runs with ./hermit
  return upath.join(...[defaultCwd, ...parts, 'bin']);
}

export async function getHermitEnvs(
  rawOptions: RawExecOptions
): Promise<Record<string, string>> {
  const cwd = rawOptions.cwd?.toString() ?? '';
  const hermitCwd = await findHermitCwd(cwd);
  logger.debug({ cwd, hermitCwd }, 'fetching hermit environment variables');
  // with -r will output the raw unquoted environment variables to consume
  const hermitEnvResp = await rawExec('./hermit env -r', {
    ...rawOptions,
    cwd: hermitCwd,
  });
  return hermitEnvResp.stdout
    .split(os.EOL)
    .reduce((acc: Record<string, string>, line): Record<string, string> => {
      const trimmedLine = line.trim();
      if (trimmedLine === '') {
        return acc;
      }
      const equalIndex = trimmedLine.indexOf('=');
      const name = trimmedLine.substring(0, equalIndex);
      acc[name] = trimmedLine.substring(equalIndex + 1);
      return acc;
    }, {});
}
