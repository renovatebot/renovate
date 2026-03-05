import upath from 'upath';
import { GlobalConfig } from '../../config/global.ts';
import { logger } from '../../logger/index.ts';
import { findUpLocal } from '../fs/index.ts';
import { newlineRegex } from '../regex.ts';
import { coerceString } from '../string.ts';
import { rawExec } from './common.ts';
import type { RawExecOptions } from './types.ts';

export function isHermit(): boolean {
  return GlobalConfig.get('binarySource') === 'hermit';
}

export async function findHermitCwd(cwd: string): Promise<string> {
  const relativeCwd = upath.relative(GlobalConfig.get('localDir', ''), cwd);
  const hermitFile = await findUpLocal('bin/hermit', relativeCwd);

  if (hermitFile === null) {
    throw new Error(`hermit not found for ${cwd}`);
  }

  return upath.join(GlobalConfig.get('localDir'), upath.dirname(hermitFile));
}

export async function getHermitEnvs(
  rawOptions: RawExecOptions,
): Promise<Record<string, string>> {
  const cwd = coerceString(rawOptions.cwd);
  const hermitCwd = await findHermitCwd(cwd);
  logger.debug({ cwd, hermitCwd }, 'fetching hermit environment variables');
  // with -r will output the raw unquoted environment variables to consume
  const hermitEnvResp = await rawExec('./hermit env -r', {
    ...rawOptions,
    cwd: hermitCwd,
  });

  const out: Record<string, string> = {};

  const lines = hermitEnvResp.stdout
    .split(newlineRegex)
    .map((line) => line.trim())
    .filter((line) => line.includes('='));
  for (const line of lines) {
    const equalIndex = line.indexOf('=');
    const name = line.substring(0, equalIndex);
    out[name] = line.substring(equalIndex + 1);
  }

  return out;
}
