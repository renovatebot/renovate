import os from 'os';
import fs from 'fs-extra';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { rawExec } from './common';
import type { RawExecOptions } from './types';

export function isHermit(): boolean {
  const { binarySource } = GlobalConfig.get();
  return binarySource === 'hermit';
}

function statFileSync(f: string): fs.Stats | undefined {
  let exists: fs.Stats | undefined = undefined;
  try {
    exists = fs.statSync(f);
  } catch (e) {
    // not doing anything when file not exists for errors
  }

  return exists;
}

function statHermit(defaultCwd: string, parts: string[]): fs.Stats | undefined {
  const hermitForCwd = upath.join(...[defaultCwd, ...parts, 'bin', 'hermit']);
  logger.trace({ hermitForCwd }, 'looking up hermit');
  return statFileSync(hermitForCwd);
}

export function findHermitCwd(cwd: string): string {
  const defaultCwd = GlobalConfig.get('localDir') ?? '';
  const parts = cwd.replace(defaultCwd, '').split(upath.sep);
  let exists: fs.Stats | undefined = undefined;

  // search the current relative path until reach the defaultCwd
  while (parts.length > 0) {
    exists = statHermit(defaultCwd, parts);
    // on file found. break out of the loop
    if (exists !== undefined) {
      break;
    }
    // otherwise, continue searching in parent directory
    parts.pop();
  }

  // search in defaultCwd
  if (exists === undefined) {
    exists = statHermit(defaultCwd, parts);
  }

  if (exists === undefined) {
    throw new Error(`hermit not found for ${cwd}`);
  }

  // once the path is found, return ${[path}/bin
  // so that hermit runs with ./hermit
  return upath.join(...[defaultCwd, ...parts, 'bin']);
}

export async function getHermitEnvs(
  rawOptions: RawExecOptions
): Promise<Record<string, string>> {
  const cwd = (rawOptions.cwd ?? '').toString();
  const hermitCwd = findHermitCwd(cwd);
  logger.debug({ cwd, hermitCwd }, 'fetching hermit environment variables');
  // with -r will output the raw unquoted environment variables to consume
  const hermitEnvResp = await rawExec('./hermit env -r', {
    ...rawOptions,
    cwd: hermitCwd,
  });
  const hermitEnvVars = hermitEnvResp.stdout
    .split(os.EOL)
    .reduce((acc: Record<string, string>, line): Record<string, string> => {
      const trimmedLine = line.trim();
      if (trimmedLine === '') {
        return acc;
      }
      const equalIndex = trimmedLine.indexOf('=');
      const name = trimmedLine.substring(0, equalIndex);
      const value = trimmedLine.substring(equalIndex + 1);
      acc[name] = value;
      return acc;
    }, {});

  return hermitEnvVars;
}
