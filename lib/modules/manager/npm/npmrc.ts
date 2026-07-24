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

interface SanitizedRepoNpmrc {
  content: string;
  detectedLineEnding: NpmrcDocument['detectedLineEnding'];
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
    if (line.type === 'other') {
      retainedLines.push(line);
      continue;
    }

    const isTopLevelSettingForNpm = line.npmSection === null;
    if (
      line.type === 'setting' &&
      isTopLevelSettingForNpm &&
      line.key === 'package-lock'
    ) {
      removedPackageLockSetting = true;
      continue;
    }

    if (
      isTopLevelSettingForNpm &&
      !allowEnvironmentVariableReferences &&
      line.environmentVariableReferences.length > 0
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
