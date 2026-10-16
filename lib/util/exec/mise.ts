import { z } from 'zod/v4';
import { GlobalConfig } from '../../config/global.ts';
import { logger } from '../../logger/index.ts';
import { api as semver } from '../../modules/versioning/semver/index.ts';
import { findGithubToken } from '../check-token.ts';
import * as hostRules from '../host-rules.ts';
import { regEx } from '../regex.ts';
import { Json } from '../schema-utils/index.ts';
import { rawExec } from './common.ts';
import type { RawExecOptions } from './types.ts';

/**
 * First mise release that supports `MISE_SAFE=1` safe mode (a hard boundary
 * against project config executing code) and `mise lock --bump`.
 *
 * @see https://github.com/jdx/mise/pull/11146
 * @see https://github.com/jdx/mise/pull/11145
 * @see https://mise.jdx.dev/configuration/settings.html#safe
 */
export const MISE_SAFE_MODE_MIN_VERSION = '2026.7.12';

const MiseEnv = Json.pipe(z.record(z.string(), z.string()));

export function isMise(): boolean {
  return GlobalConfig.get('binarySource') === 'mise';
}

/**
 * Extracts the `major.minor.patch` version from `mise version` output.
 */
export function parseMiseVersion(stdout: string): string | null {
  const version = regEx(/\d+\.\d+\.\d+/).exec(stdout)?.[0];
  if (version && semver.isVersion(version)) {
    return version;
  }
  return null;
}

/**
 * Returns true when `version` is at or above {@link MISE_SAFE_MODE_MIN_VERSION}.
 */
export function supportsSafeMode(version: string | null): boolean {
  return (
    !!version &&
    (semver.equals(version, MISE_SAFE_MODE_MIN_VERSION) ||
      semver.isGreaterThan(version, MISE_SAFE_MODE_MIN_VERSION))
  );
}

async function getMiseSecurityEnv(
  rawOptions: RawExecOptions,
): Promise<Record<string, string>> {
  const allowlist = GlobalConfig.get('allowedUnsafeExecutions');
  if (allowlist.includes('mise')) {
    return {
      MISE_TRUSTED_CONFIG_PATHS: GlobalConfig.get('localDir'),
      MISE_YES: '1',
    };
  }

  const { stdout } = await rawExec('mise version', rawOptions);
  const version = parseMiseVersion(stdout);
  if (!supportsSafeMode(version)) {
    throw new Error(
      `binarySource=mise requires mise >= ${MISE_SAFE_MODE_MIN_VERSION} (found ${version ?? 'unknown'}), or \`mise\` in \`allowedUnsafeExecutions\``,
    );
  }
  return { MISE_SAFE: '1' };
}

export async function getMiseEnvs(
  rawOptions: RawExecOptions,
): Promise<Record<string, string>> {
  const securityEnv = await getMiseSecurityEnv(rawOptions);
  const token = findGithubToken(
    hostRules.find({
      hostType: 'github',
      url: 'https://api.github.com/',
    }),
  );
  const miseOptions: RawExecOptions = {
    ...rawOptions,
    env: {
      ...(token && { MISE_GITHUB_TOKEN: token }),
      ...rawOptions.env,
      ...securityEnv,
    },
  };

  logger.debug(
    { cwd: rawOptions.cwd, safeMode: securityEnv.MISE_SAFE === '1' },
    'installing mise tools and fetching mise environment variables',
  );
  await rawExec('mise install', miseOptions);
  const miseEnvResp = await rawExec('mise env --json', miseOptions);

  return MiseEnv.parse(miseEnvResp.stdout);
}
