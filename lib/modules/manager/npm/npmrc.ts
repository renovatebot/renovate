import { isString, isUndefined } from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { hasUrlCredentials } from '../../../util/url.ts';
import type { NpmrcPackageFile } from '../types.ts';
import { parseNpmrc, renderNpmrc } from './npmrc-parser.ts';
import type {
  NpmManagerData,
  NpmrcConfig,
  NpmrcLine,
  NpmrcLineEnding,
  NpmrcResult,
  NpmrcSettingLine,
  SanitizedRepoNpmrc,
} from './types.ts';

/**
 * Mirrors npm's environment-reference grammar. Escape handling remains
 * procedural because RE2 does not support lookbehind.
 */
const environmentVariableReferenceRegex = regEx(
  // oxlint-disable-next-line prefer-named-capture-group -- Only the full match and its position are used.
  /\$\{([^${}?]+)(\?)?\}/g,
);

function containsEnvironmentVariableReference(value: unknown): boolean {
  if (!isString(value)) {
    return false;
  }

  for (const match of value.matchAll(environmentVariableReferenceRegex)) {
    let escapeCount = 0;
    let escapeIndex = match.index - 1;
    while (value[escapeIndex] === '\\') {
      escapeCount += 1;
      escapeIndex -= 1;
    }

    if (escapeCount % 2 === 0) {
      return true;
    }
  }

  return false;
}

function hasEnvironmentVariableReference(line: NpmrcSettingLine): boolean {
  return (
    containsEnvironmentVariableReference(line.key) ||
    containsEnvironmentVariableReference(line.value)
  );
}

function sanitizeRepoNpmrc(
  repoNpmrc: string,
  npmrcFileName: string,
): SanitizedRepoNpmrc {
  const document = parseNpmrc(repoNpmrc);
  const retainedLines: NpmrcLine[] = [];
  const allowEnvironmentVariableReferences = GlobalConfig.get('exposeAllEnv');
  let removedEnvironmentVariableReferenceLine = false;
  let removedPackageLockSetting = false;

  for (const line of document.lines) {
    if (line.type !== 'setting' || line.section !== null) {
      retainedLines.push(line);
      continue;
    }

    if (line.key === 'package-lock') {
      removedPackageLockSetting = true;
      continue;
    }

    if (
      !allowEnvironmentVariableReferences &&
      hasEnvironmentVariableReference(line)
    ) {
      removedEnvironmentVariableReferenceLine = true;
      continue;
    }

    retainedLines.push(line);
  }

  if (removedPackageLockSetting) {
    logger.debug('Stripping package-lock setting from .npmrc');
  }

  if (removedEnvironmentVariableReferenceLine) {
    logger.debug(
      { npmrcFileName },
      'Stripping .npmrc file of lines with variables',
    );
  }

  return {
    fileName: npmrcFileName,
    content: renderNpmrc(retainedLines),
    detectedLineEnding: document.detectedLineEnding,
  };
}

function mergeNpmrcDocuments(
  configNpmrc: string | undefined,
  sanitizedRepoNpmrc: SanitizedRepoNpmrc,
): string {
  if (!configNpmrc) {
    return sanitizedRepoNpmrc.content;
  }

  const configDocument = parseNpmrc(configNpmrc);
  if (configDocument.trailingLineEnding) {
    return `${configNpmrc}${sanitizedRepoNpmrc.content}`;
  }

  const separator: Exclude<NpmrcLineEnding, ''> =
    configDocument.detectedLineEnding ??
    sanitizedRepoNpmrc.detectedLineEnding ??
    '\n';

  return `${configNpmrc}${separator}${sanitizedRepoNpmrc.content}`;
}

/**
 * Whether the repository `.npmrc` is ignored in favour of a configured `npmrc` without `npmrcMerge`.
 */
function isRepoNpmrcIgnored(config: NpmrcConfig): boolean {
  return isString(config.npmrc) && !config.npmrcMerge;
}

/**
 * Combines the configured `npmrc` with the sanitized repository `.npmrc`, honouring `npmrcMerge`.
 *
 * @returns the `npmrc` to use for the package file, or `undefined` when there is neither
 */
export function applyConfigNpmrc(
  config: NpmrcConfig,
  repoNpmrc: SanitizedRepoNpmrc | undefined,
): string | undefined {
  if (!repoNpmrc) {
    return isString(config.npmrc) ? config.npmrc : undefined;
  }

  if (isRepoNpmrcIgnored(config)) {
    logger.info(
      { npmrcFileName: repoNpmrc.fileName },
      'Repo .npmrc file is ignored due to config.npmrc with config.npmrcMerge=false',
    );

    return config.npmrc;
  }

  return mergeNpmrcDocuments(config.npmrc, repoNpmrc);
}

/**
 * The npm settings holding a secret: the auth settings, and `key` with an inline client key; `username`, `email`, `cert`, `certfile` and `keyfile` are not.
 *
 * @see https://docs.npmjs.com/cli/configuring-npm/npmrc#auth-related-configuration
 */
const credentialKeyRegex = regEx(/(?:^|:)(?:_auth|_authToken|_password|key)$/i);

const singleEnvironmentVariableReferenceRegex = regEx(
  /^\$\{[a-z_][a-z\d_]*\}$/i,
);

/**
 * Whether `value` is exactly one `${NAME}` environment variable reference.
 */
function isSingleEnvironmentVariableReference(value: unknown): boolean {
  return isString(value) && singleEnvironmentVariableReferenceRegex.test(value);
}

function hasRegistryUrlCredentials(value: unknown): boolean {
  if (!isString(value)) {
    return false;
  }
  // a protocol-relative registry URL is given a scheme, which `hasUrlCredentials()` looks for
  return hasUrlCredentials(value.startsWith('//') ? `https:${value}` : value);
}

/**
 * Whether the registry URL of a `//host/:setting` or `https://host/:setting` key, the part before its last `:`, carries credentials.
 */
function hasKeyUrlCredentials(key: string): boolean {
  const separatorIndex = key.lastIndexOf(':');
  if (separatorIndex === -1) {
    return false;
  }
  return hasRegistryUrlCredentials(key.slice(0, separatorIndex));
}

/**
 * Whether the sanitized repository `.npmrc` carries credentials: an `_auth`, `_authToken`, `_password` or `key` setting other than exactly one `${NAME}` reference, or a URL with credentials in its userinfo, in a setting's key or value.
 */
export function hasNpmrcCredentials(repoNpmrc: SanitizedRepoNpmrc): boolean {
  const settings = parseNpmrc(repoNpmrc.content).lines.filter(
    (line): line is NpmrcSettingLine => line.type === 'setting',
  );
  for (const line of settings) {
    if (hasKeyUrlCredentials(line.key)) {
      return true;
    }
    // an environment variable reference is only replaced when the `.npmrc` is used, so the stored value is not a credential
    if (isSingleEnvironmentVariableReference(line.value)) {
      continue;
    }
    if (
      credentialKeyRegex.test(line.key) ||
      hasRegistryUrlCredentials(line.value)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Matches the characters which start a comment in an `.npmrc`, at the start of a line or inline.
 */
const npmrcCommentRegex = regEx(/[#;]/);

/**
 * Whether the repository `.npmrc` has content `hasNpmrcCredentials()` does not read: a `#` or `;` anywhere, which may start a comment, or a non-blank line which is neither a setting nor a section.
 */
function hasUnreadContent(repoNpmrc: SanitizedRepoNpmrc): boolean {
  return (
    npmrcCommentRegex.test(repoNpmrc.content) ||
    parseNpmrc(repoNpmrc.content).lines.some(
      (line) => line.type === 'other' && !!line.raw.trim(),
    )
  );
}

/**
 * Why a repository `.npmrc` is not cached: it carries credentials, or has content which is not checked for credentials.
 */
type UncachedNpmrcReason = 'credentials' | 'unread-content';

/**
 * Returns why `repoNpmrc` is not cached, or `null` when it is cached.
 */
function getUncachedNpmrcReason(
  repoNpmrc: SanitizedRepoNpmrc,
): UncachedNpmrcReason | null {
  if (hasNpmrcCredentials(repoNpmrc)) {
    return 'credentials';
  }
  if (hasUnreadContent(repoNpmrc)) {
    return 'unread-content';
  }
  return null;
}

/**
 * Returns shallow copies of the package files without their `npmrc`, as they are put into the repository cache.
 *
 * A repository `.npmrc` carrying credentials, or with a comment or another line which is not checked for credentials, is dropped as well and the copy is marked with its `uncachedNpmrcFileName`. So is a copy of a package file with an `npmrcFileName` but without `npmrc`, whose repository `.npmrc` cannot be read.
 */
export function stripNpmrc(
  packageFiles: NpmrcPackageFile<NpmManagerData>[],
): NpmrcPackageFile<NpmManagerData>[] {
  const result: NpmrcPackageFile<NpmManagerData>[] = [];
  // the workspaces of a monorepo share one `.npmrc`, which is classified once
  const reasonByContent = new Map<string, UncachedNpmrcReason | null>();
  for (const packageFile of packageFiles) {
    const copy = { ...packageFile };
    delete copy.npmrc;
    // read from disk again, so that the configured `npmrc` is not used in its place when the package file is restored
    const npmrcFileName = copy.managerData?.npmrcFileName;
    if (npmrcFileName && !isString(packageFile.npmrc)) {
      copy.managerData = {
        ...copy.managerData,
        uncachedNpmrcFileName: npmrcFileName,
      };
    }
    const repoNpmrc = copy.managerData?.repoNpmrc;
    if (repoNpmrc) {
      let reason = reasonByContent.get(repoNpmrc.content);
      if (reason === undefined) {
        reason = getUncachedNpmrcReason(repoNpmrc);
        reasonByContent.set(repoNpmrc.content, reason);
      }
      if (reason === 'credentials') {
        logger.once.warn(
          { npmrcFileName: repoNpmrc.fileName },
          'A repository .npmrc contains credentials, which are not cached: configure them through hostRules or the npmrc option instead',
        );
      } else if (reason === 'unread-content') {
        logger.once.debug(
          { npmrcFileName: repoNpmrc.fileName },
          'A repository .npmrc contains comments or lines which are not settings, so it is not cached',
        );
      }
      if (reason) {
        copy.managerData = {
          ...copy.managerData,
          uncachedNpmrcFileName: repoNpmrc.fileName,
        };
        delete copy.managerData.repoNpmrc;
      }
    }
    result.push(copy);
  }
  return result;
}

/**
 * Whether `packageFile` was extracted with an `npmrc` from `resolveNpmrc()`, which also sets its `npmrcFileName`, `null` without a repository `.npmrc`.
 */
function hasResolvedNpmrc(
  packageFile: NpmrcPackageFile<NpmManagerData>,
): boolean {
  return !isUndefined(packageFile.managerData?.npmrcFileName);
}

/**
 * Returns shallow copies of cached package files with their `npmrc` rebuilt from the cached repository `.npmrc` and the config, or read from disk again for a file with an `uncachedNpmrcFileName`.
 * A package file extracted without `npmrc`, such as a `pnpm-workspace.yaml` or `.yarnrc.yml` catalog, is copied without one.
 */
export async function restoreNpmrc(
  packageFiles: NpmrcPackageFile<NpmManagerData>[],
  config: NpmrcConfig,
): Promise<NpmrcPackageFile<NpmManagerData>[]> {
  const result: NpmrcPackageFile<NpmManagerData>[] = [];
  // the workspaces of a monorepo share one `.npmrc`, which is read once
  const npmrcByFileName = new Map<string, string | undefined>();
  for (const packageFile of packageFiles) {
    if (!hasResolvedNpmrc(packageFile)) {
      result.push({ ...packageFile });
      continue;
    }
    let npmrc: string | undefined;
    const uncachedNpmrcFileName =
      packageFile.managerData?.uncachedNpmrcFileName;
    if (uncachedNpmrcFileName) {
      if (!npmrcByFileName.has(uncachedNpmrcFileName)) {
        const read = await readRepoNpmrc(uncachedNpmrcFileName, config);
        npmrcByFileName.set(uncachedNpmrcFileName, read.npmrc);
      }
      npmrc = npmrcByFileName.get(uncachedNpmrcFileName);
    } else {
      npmrc = applyConfigNpmrc(config, packageFile.managerData?.repoNpmrc);
    }
    result.push({ ...packageFile, ...(isString(npmrc) && { npmrc }) });
  }
  return result;
}

/**
 * Whether any of the cached package files has an `uncachedNpmrcFileName`.
 */
export function hasUncachedNpmrc(
  packageFiles: NpmrcPackageFile<NpmManagerData>[],
): boolean {
  return packageFiles.some(
    (packageFile) => !!packageFile.managerData?.uncachedNpmrcFileName,
  );
}

/**
 * Reads and sanitizes the repository `.npmrc` and combines it with the configured `npmrc`.
 *
 * @returns the `npmrc` to use, `undefined` when the repository `.npmrc` cannot be read, and the sanitized repository `.npmrc` when it is readable and not ignored
 */
async function readRepoNpmrc(
  npmrcFileName: string,
  config: NpmrcConfig,
): Promise<Omit<NpmrcResult, 'npmrcFileName'>> {
  const content = await readLocalFile(npmrcFileName, 'utf8');
  if (!isString(content)) {
    return { npmrc: undefined };
  }

  const repoNpmrc = sanitizeRepoNpmrc(content, npmrcFileName);
  const npmrc = applyConfigNpmrc(config, repoNpmrc);
  if (isRepoNpmrcIgnored(config)) {
    return { npmrc };
  }
  return { npmrc, repoNpmrc };
}

export async function resolveNpmrc(
  packageFile: string,
  config: NpmrcConfig,
): Promise<NpmrcResult> {
  const npmrcFileName = await findLocalSiblingOrParent(packageFile, '.npmrc');
  if (!npmrcFileName) {
    return {
      npmrc: applyConfigNpmrc(config, undefined),
      npmrcFileName,
    };
  }

  return { ...(await readRepoNpmrc(npmrcFileName, config)), npmrcFileName };
}
