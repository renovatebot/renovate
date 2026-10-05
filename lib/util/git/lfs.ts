import { pathToFileURL } from 'node:url';
import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import semver from 'semver';
import upath from 'upath';
import { z } from 'zod/v4';
import { GlobalConfig } from '../../config/global.ts';
import { CONFIG_VALIDATION } from '../../constants/error-messages.ts';
import { logger } from '../../logger/index.ts';
import { coerceArray } from '../array.ts';
import type { ResolvedChildEnv } from '../exec/utils.ts';
import { newlineRegex, regEx } from '../regex.ts';
import { Json } from '../schema-utils/index.ts';
import { parseUrl } from '../url.ts';
import type { GitConfigEntry } from './config.ts';
import { addGitConfigEnvironmentVariables } from './config.ts';
import { checkForPlatformFailure } from './error.ts';

export type GitLfsMode = 'disabled' | 'upload' | 'enabled';

export const LFS_POINTER_VERSION = 'version https://git-lfs.github.com/spec/v1';

export const GIT_LFS_MIN_VERSION: Record<'upload' | 'enabled', string> = {
  upload: '3.2.0',
  enabled: '3.7.1',
};

const LFS_POINTER_MAX_SIZE = 1024;

export interface LfsState {
  mode: GitLfsMode;
  active: boolean;
  endpoint: string | null;
  /** `endpoint` with the remote URL's credentials, only ever passed to Git as `lfs.url` and `lfs.pushurl` */
  authEndpoint: string | null;
  include: string[];
  authenticated: boolean;
  inactiveReason?: 'ssh' | 'fork' | 'external-lfs-server';
}

export function toGitLfsMode(value: unknown): GitLfsMode {
  // fail closed: anything but an explicit `upload` or `enabled` means disabled
  return value === 'upload' || value === 'enabled' ? value : 'disabled';
}

export function getGitLfsMode(): GitLfsMode {
  return toGitLfsMode(GlobalConfig.get('gitLfs'));
}

function stripUrl(url: URL): void {
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(regEx(/\/+$/), '');
}

function stripTrailingSlash(value: string): string {
  return value.replace(regEx(/\/+$/), '');
}

/**
 * Returns the Git LFS endpoint of a remote URL, without credentials, or `null` if it cannot be derived.
 */
export function getLfsEndpoint(remoteUrl: string): string | null {
  if (upath.isAbsolute(remoteUrl)) {
    return pathToFileURL(remoteUrl).href;
  }

  const url = parseUrl(remoteUrl);
  if (!url) {
    return null;
  }

  if (url.protocol === 'file:') {
    return stripTrailingSlash(url.href);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }

  stripUrl(url);
  url.pathname = url.pathname.endsWith('.git')
    ? `${url.pathname}/info/lfs`
    : `${url.pathname}.git/info/lfs`;
  return url.href;
}

/**
 * Returns `endpoint` with the credentials of `remoteUrl`, which Renovate built for the same repository.
 *
 * git-lfs does not reuse the remote URL's credentials once `lfs.url` is set, and unlike Git it prompts for the password when the URL has only a username (e.g. a token as the username on GitHub), so an empty password is made explicit.
 */
export function getLfsAuthEndpoint(
  remoteUrl: string,
  endpoint: string,
): string {
  const remote = parseUrl(remoteUrl);
  if (!remote?.username || !endpoint.startsWith(`${remote.protocol}//`)) {
    return endpoint;
  }
  const rest = endpoint.slice(`${remote.protocol}//`.length);
  return `${remote.protocol}//${remote.username}:${remote.password}@${rest}`;
}

/**
 * Normalizes an LFS endpoint or remote URL found in `.lfsconfig` so it can be compared with the pinned endpoint.
 */
export function normalizeEndpointForCompare(value: string): string | null {
  const trimmed = stripTrailingSlash(value.trim());
  if (!trimmed.endsWith('/info/lfs')) {
    return getLfsEndpoint(trimmed);
  }

  const url = parseUrl(trimmed);
  if (!url) {
    return null;
  }
  stripUrl(url);
  return url.href;
}

/**
 * Returns the host of the first endpoint in `git config --get-regexp` output that differs from `endpoint`, or `null` if all match.
 */
export function findLfsConfigConflict(
  output: string,
  endpoint: string,
): string | null {
  const lines = output
    .split(newlineRegex)
    .filter(isNonEmptyStringAndNotWhitespace);
  for (const line of lines) {
    const value = line.trim().replace(regEx(/^\S+\s*/), '');
    const normalized = normalizeEndpointForCompare(value);
    if (normalized !== endpoint) {
      return getLfsEndpointHost(normalized ?? value);
    }
  }
  return null;
}

export function getLfsEndpointHost(value: string): string {
  return parseUrl(value)?.host ?? 'unknown';
}

function isSelective(state: LfsState): boolean {
  return state.mode === 'enabled' && state.include.length > 0;
}

/**
 * Returns the Git config entries that Renovate passes to every repository Git call while Git LFS is active.
 */
export function getLfsGitConfig(state: LfsState): GitConfigEntry[] {
  const endpoint = state.authEndpoint ?? state.endpoint ?? '';
  const entries: GitConfigEntry[] = [
    { key: 'filter.lfs.clean', value: 'git-lfs clean -- %f' },
    { key: 'filter.lfs.required', value: 'true' },
    { key: 'core.hooksPath', value: '/dev/null' },
    { key: 'lfs.url', value: endpoint },
    { key: 'lfs.pushurl', value: endpoint },
    { key: 'lfs.locksverify', value: 'false' },
    { key: 'lfs.allowincompletepush', value: 'false' },
    { key: 'lfs.skipdownloaderrors', value: 'false' },
    { key: 'lfs.setlockablereadonly', value: 'false' },
  ];

  if (isSelective(state)) {
    entries.push(
      { key: 'filter.lfs.process', value: 'git-lfs filter-process' },
      { key: 'filter.lfs.smudge', value: 'git-lfs smudge -- %f' },
      { key: 'lfs.fetchinclude', value: state.include.join(',') },
      { key: 'lfs.fetchexclude', value: '' },
    );
  } else {
    // an empty `lfs.fetchinclude` together with an empty `lfs.fetchexclude` means "everything"
    entries.push(
      { key: 'filter.lfs.process', value: 'git-lfs filter-process --skip' },
      { key: 'filter.lfs.smudge', value: 'git-lfs smudge --skip -- %f' },
      { key: 'lfs.fetchinclude', value: '' },
      { key: 'lfs.fetchexclude', value: '*' },
    );
  }

  return entries;
}

export function getLfsForcedEnv(state: LfsState): Record<string, string> {
  return {
    GIT_LFS_SKIP_PUSH: '1',
    GIT_LFS_SET_LOCKABLE_READONLY: '0',
    GIT_LFS_SKIP_SMUDGE: isSelective(state) ? '0' : '1',
  };
}

const LFS_PROTECTED_ENV = [
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',
  'GIT_CONFIG_NOSYSTEM',
  'GIT_CONFIG',
  'XDG_CONFIG_HOME',
  'HOME',
  'GIT_DIR',
  'GIT_COMMON_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
];

const gitConfigEnvRegex = regEx(/^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+)$/);
const lfsUnsafeEnvRegex = regEx(
  /^(?:GIT_CONFIG_PARAMETERS|GIT_LFS_.*|GIT_TRACE.*|GIT_CURL_VERBOSE|GIT_TRANSFER_TRACE)$/,
);

/**
 * Removes environment variables that could change the Git LFS behaviour or override the pinned Git config.
 */
export function sanitizeEnvForLfs(
  env: ResolvedChildEnv,
  userEnv: Record<string, string>,
  adminEnv: Record<string, string | undefined>,
): ResolvedChildEnv {
  const result = { ...env };

  for (const key of Object.keys(result)) {
    if (lfsUnsafeEnvRegex.test(key)) {
      delete result[key];
    }
  }

  if (Object.keys(userEnv).some((key) => gitConfigEnvRegex.test(key))) {
    for (const key of Object.keys(result)) {
      if (gitConfigEnvRegex.test(key)) {
        delete result[key];
      }
    }
    logger.once.warn(
      'Ignoring GIT_CONFIG_* from repository env because gitLfs is enabled',
    );
  }

  const keys = LFS_PROTECTED_ENV.filter((key) => key in userEnv);
  for (const key of keys) {
    const adminValue = adminEnv[key];
    if (adminValue === undefined) {
      delete result[key];
    } else {
      result[key] = adminValue;
    }
  }
  if (keys.length) {
    logger.once.warn(
      { keys },
      'Ignoring repository env variables that would change Git configuration because gitLfs is enabled',
    );
  }

  return result;
}

export function applyLfsConfig(
  env: ResolvedChildEnv,
  state: LfsState,
): ResolvedChildEnv {
  return addGitConfigEnvironmentVariables(
    { ...env, ...getLfsForcedEnv(state) },
    getLfsGitConfig(state),
  );
}

const pointerOidRegex = regEx(/^oid sha256:(?<oid>[0-9a-f]{64})$/);
const pointerSizeRegex = regEx(/^size (?<size>0|[1-9]\d{0,15})$/);
const pointerExtRegex = regEx(/^ext-\d+-\w+ sha256:[0-9a-f]{64}$/);

/**
 * Parses a Git LFS pointer file, returning `null` if the content is not a valid pointer.
 */
export function parseLfsPointer(
  content: string | Buffer,
): { oid: string; size: number } | null {
  if (content.length > LFS_POINTER_MAX_SIZE) {
    return null;
  }
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : content;
  if (!text.startsWith(LFS_POINTER_VERSION)) {
    return null;
  }

  const lines = text.replaceAll('\r\n', '\n').split('\n');
  if (lines.at(-1) === '') {
    lines.pop();
  }
  if (lines[0] !== LFS_POINTER_VERSION) {
    return null;
  }

  const oids: string[] = [];
  const sizes: number[] = [];
  for (const line of lines.slice(1)) {
    const oidMatch = pointerOidRegex.exec(line)?.groups;
    const sizeMatch = pointerSizeRegex.exec(line)?.groups;
    if (oidMatch) {
      oids.push(oidMatch.oid);
    } else if (sizeMatch) {
      sizes.push(parseInt(sizeMatch.size, 10));
    } else if (!pointerExtRegex.test(line)) {
      return null;
    }
  }

  if (oids.length !== 1 || sizes.length !== 1) {
    return null;
  }
  return { oid: oids[0], size: sizes[0] };
}

export function isLfsPointer(content: string | Buffer): boolean {
  return parseLfsPointer(content) !== null;
}

/**
 * Logs a warning once per file if the content is a Git LFS pointer.
 */
export function logWarningIfGitLfsPointer(
  fileName: string,
  content: string | Buffer,
  mode: GitLfsMode,
  active: boolean,
): void {
  if (!isLfsPointer(content)) {
    return;
  }
  if (mode === 'enabled' && active) {
    logger.once.warn(
      { fileName },
      'File is stored in Git LFS and Renovate read its LFS pointer instead of the content. Add it to `gitLfsInclude` so Renovate downloads it.',
    );
  } else {
    logger.once.warn(
      { fileName },
      'File is stored in Git LFS and Renovate read its LFS pointer instead of the content. See the `gitLfs` documentation.',
    );
  }
}

const LfsFile = z.object({
  name: z.string(),
  oid: z.string(),
  size: z.number(),
  downloaded: z.boolean(),
});
export type LfsFile = z.infer<typeof LfsFile>;

export const LfsLsFiles = Json.pipe(
  z.object({
    files: z.array(LfsFile).nullable().catch([]),
  }),
)
  .transform(({ files }) => coerceArray(files))
  .catch([]);

const lfsOidRegex = regEx(/^[0-9a-f]{64}$/);

/**
 * Selects the unique OIDs of the files which exist in the local LFS store.
 */
export function selectUploadOids(files: LfsFile[]): {
  oids: string[];
  skipped: string[];
  bytes: number;
} {
  const oids = new Set<string>();
  const skipped: string[] = [];
  let bytes = 0;
  for (const file of files) {
    if (!file.downloaded || !lfsOidRegex.test(file.oid)) {
      skipped.push(file.name);
    } else if (!oids.has(file.oid)) {
      oids.add(file.oid);
      bytes += file.size;
    }
  }
  return { oids: [...oids], skipped, bytes };
}

export function chunk<T>(items: T[], size = 100): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * Removes credentials from a git-lfs error message.
 */
export function sanitizeLfsError(err: Error): Error {
  const message = err.message
    .split(newlineRegex)
    .filter((line) => !line.includes('current Git remote contains credentials'))
    .join('\n')
    .replace(regEx(/\/\/[^/@\s]+@/g), '//***@');
  return new Error(message, { cause: err });
}

export function parseGitLfsVersion(output: string): string | null {
  return (
    regEx(/git-lfs\/(?<version>\d+\.\d+\.\d+)/).exec(output)?.groups?.version ??
    null
  );
}

export async function validateGitLfsVersion(
  mode: 'upload' | 'enabled',
  rawFn: (args: string[]) => Promise<string>,
): Promise<{ ok: boolean; version: string | null }> {
  let version: string | null;
  try {
    version = parseGitLfsVersion(await rawFn(['lfs', 'version']));
  } catch (err) {
    logger.debug({ err }, 'Error fetching git-lfs version');
    return { ok: false, version: null };
  }
  const ok = !!version && semver.gte(version, GIT_LFS_MIN_VERSION[mode]);
  return { ok, version };
}

const gitLfsErrors = new WeakSet<Error>();

/**
 * Returns whether the error was thrown by `mapGitLfsError`, so it must not be mapped again.
 */
export function isGitLfsError(err: unknown): boolean {
  return err instanceof Error && gitLfsErrors.has(err);
}

/**
 * Maps a git-lfs error to the error that Renovate throws.
 */
export function mapGitLfsError(err: Error, op: 'upload' | 'download'): Error {
  const sanitized = sanitizeLfsError(err);
  let result = checkForPlatformFailure(sanitized);
  if (!result) {
    if (op === 'download') {
      const firstLine =
        sanitized.message
          .split(newlineRegex)
          .find(isNonEmptyStringAndNotWhitespace)
          ?.trim() ?? '';
      result = new Error(CONFIG_VALIDATION);
      result.validationSource = 'gitLfsInclude';
      result.validationError = 'Git LFS download failed';
      result.validationMessage = `Renovate could not download Git LFS content for paths matching \`gitLfsInclude\`: \`${firstLine.replaceAll('`', "'")}\``;
    } else {
      result = new Error(`git-lfs push failed: ${sanitized.message}`);
    }
  }
  gitLfsErrors.add(result);
  return result;
}
