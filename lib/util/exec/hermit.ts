import os from 'os';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { findUpLocal } from '../fs';
import { rawExec } from './common';
import type { RawExecOptions } from './types';

export function isHermit(): boolean {
  const { binarySource } = GlobalConfig.get();
  return binarySource === 'hermit';
}

export async function findHermitCwd(cwd: string): Promise<string> {
  const relativeCwd = upath.relative(GlobalConfig.get('localDir') ?? '', cwd);
  const hermitFile = await findUpLocal('bin/hermit', relativeCwd);

  if (hermitFile === null) {
    throw new Error(`hermit not found for ${cwd}`);
  }

  return upath.join(GlobalConfig.get('localDir'), upath.dirname(hermitFile));
}

export async function getHermitEnvs(
  rawOptions: RawExecOptions
): Promise<Record<string, string>> {
  const cwd = rawOptions.cwd ?? '';
  const hermitCwd = await findHermitCwd(cwd);
  logger.debug({ cwd, hermitCwd }, 'fetching hermit environment variables');
  // with -r will output the raw unquoted environment variables to consume
  const hermitEnvResp = await rawExec('./hermit env -r', {
    ...rawOptions,
    cwd: hermitCwd,
  });

  const lines = hermitEnvResp.stdout.split(os.EOL);

  const out = {} as Record<string, string>;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === '') {
      continue;
    }
    const equalIndex = trimmedLine.indexOf('=');
    const name = trimmedLine.substring(0, equalIndex);
    out[name] = trimmedLine.substring(equalIndex + 1);
  }

  return out;
}
