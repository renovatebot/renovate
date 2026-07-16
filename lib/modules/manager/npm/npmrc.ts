import { isString } from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../util/fs/index.ts';
import type {
  NpmrcDocument,
  NpmrcLine,
  NpmrcLineEnding,
} from './npmrc-parser.ts';
import { parseNpmrc, renderNpmrc } from './npmrc-parser.ts';

export interface NpmrcResult {
  npmrc: string | undefined;
  npmrcFileName: string | null;
}

interface SanitizedNpmrc {
  content: string;
  detectedLineEnding: NpmrcDocument['detectedLineEnding'];
}

function sanitizeRepoNpmrc(
  repoNpmrc: string,
  npmrcFileName: string,
): SanitizedNpmrc {
  const document = parseNpmrc(repoNpmrc);
  const lines: NpmrcLine[] = [];
  const allowEnvironmentVariables = GlobalConfig.get('exposeAllEnv');
  let removedEnvironmentAssignments = false;
  let removedPackageLock = false;

  for (const line of document.lines) {
    if (
      line.type === 'setting' &&
      line.section === null &&
      line.key === 'package-lock'
    ) {
      removedPackageLock = true;
      continue;
    }

    if (
      line.type === 'setting' &&
      line.section === null &&
      !allowEnvironmentVariables &&
      line.environmentVariables.length > 0
    ) {
      removedEnvironmentAssignments = true;
      continue;
    }

    lines.push(line);
  }

  if (removedPackageLock) {
    logger.debug('Stripping package-lock setting from .npmrc');
  }

  if (removedEnvironmentAssignments) {
    logger.debug(
      { npmrcFileName },
      'Stripping .npmrc file of lines with variables',
    );
  }

  return {
    content: renderNpmrc(lines),
    detectedLineEnding: document.detectedLineEnding,
  };
}

function mergeNpmrcDocuments(
  configNpmrc: string | undefined,
  repoNpmrc: SanitizedNpmrc,
): string {
  if (!configNpmrc) {
    return repoNpmrc.content;
  }

  const configDocument = parseNpmrc(configNpmrc);
  if (configDocument.trailingLineEnding) {
    return `${configNpmrc}${repoNpmrc.content}`;
  }

  const separator: Exclude<NpmrcLineEnding, ''> =
    configDocument.detectedLineEnding ?? repoNpmrc.detectedLineEnding ?? '\n';

  return `${configNpmrc}${separator}${repoNpmrc.content}`;
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

  // v8 ignore if -- TODO: add test #40625
  if (!isString(repoNpmrc)) {
    return { npmrc: undefined, npmrcFileName };
  }

  if (isString(config.npmrc) && !config.npmrcMerge) {
    logger.debug(
      { npmrcFileName },
      'Repo .npmrc file is ignored due to config.npmrc with config.npmrcMerge=false',
    );

    return { npmrc: config.npmrc, npmrcFileName };
  }

  const sanitizedRepoNpmrc = sanitizeRepoNpmrc(repoNpmrc, npmrcFileName);
  const npmrc = mergeNpmrcDocuments(config.npmrc, sanitizedRepoNpmrc);
  return { npmrc, npmrcFileName };
}
