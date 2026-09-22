import { isString } from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { parseNpmrc, renderNpmrc } from './npmrc-parser.ts';
import type {
  NpmrcDocument,
  NpmrcLine,
  NpmrcLineEnding,
  NpmrcResult,
  NpmrcSettingLine,
} from './types.ts';

interface SanitizedRepoNpmrc {
  content: string;
  detectedLineEnding: NpmrcDocument['detectedLineEnding'];
}

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

export async function resolveNpmrc(
  packageFile: string,
  config: { npmrc?: string; npmrcMerge?: boolean },
): Promise<NpmrcResult> {
  const npmrcFileName = await findLocalSiblingOrParent(packageFile, '.npmrc');
  if (!npmrcFileName) {
    return {
      npmrc: isString(config.npmrc) ? config.npmrc : undefined,
      npmrcFileName,
    };
  }

  const repoNpmrc = await readLocalFile(npmrcFileName, 'utf8');

  if (!isString(repoNpmrc)) {
    return { npmrc: undefined, npmrcFileName };
  }

  if (isString(config.npmrc) && !config.npmrcMerge) {
    logger.info(
      { npmrcFileName },
      'Repo .npmrc file is ignored due to config.npmrc with config.npmrcMerge=false',
    );

    return { npmrc: config.npmrc, npmrcFileName };
  }

  const sanitizedRepoNpmrc = sanitizeRepoNpmrc(repoNpmrc, npmrcFileName);
  const npmrc = mergeNpmrcDocuments(config.npmrc, sanitizedRepoNpmrc);
  return { npmrc, npmrcFileName };
}
