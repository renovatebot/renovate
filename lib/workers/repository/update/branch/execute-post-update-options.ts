import { isNonEmptyArray, isString } from '@sindresorhus/is';

import { logger } from '../../../../logger/index.ts';
import { executeGoModTidy } from '../../../../modules/manager/gomod/post-update/tidy.ts';
import { coerceArray } from '../../../../util/array.ts';
import { localPathIsFile, writeLocalFile } from '../../../../util/fs/index.ts';
import type { FileChange } from '../../../../util/git/types.ts';
import type { BranchConfig } from '../../../types.ts';

export interface PostUpdateOptionsExecutionResult {
  updatedArtifacts: FileChange[];
  artifactErrors: NonNullable<BranchConfig['artifactErrors']>;
}

async function writeUpdatedFiles(files: FileChange[]): Promise<void> {
  for (const file of files) {
    if (file.type !== 'addition' || file.isSymlink) {
      continue;
    }

    const canWriteFile = await localPathIsFile(file.path);

    if (!canWriteFile) {
      continue;
    }

    let contents: Buffer | null;

    if (isString(file.contents)) {
      contents = Buffer.from(file.contents);
    } else {
      contents = file.contents;
    }

    await writeLocalFile(file.path, contents!);
  }
}

function mergeFileChanges(
  existingFiles: FileChange[],
  newFiles: FileChange[],
): FileChange[] {
  const result = [...existingFiles];

  for (const file of newFiles) {
    const existingIndex = result.findIndex(
      (existing) => existing.path === file.path,
    );

    if (existingIndex === -1) {
      result.push(file);
    } else {
      result[existingIndex] = file;
    }
  }

  return result;
}

export default async function executePostUpdateOptions(
  config: BranchConfig,
): Promise<PostUpdateOptionsExecutionResult | null> {
  if (config.manager !== 'gomod') {
    return null;
  }

  const hasChangedFiles =
    isNonEmptyArray(config.updatedPackageFiles) ||
    isNonEmptyArray(config.updatedArtifacts);

  if (!hasChangedFiles) {
    logger.debug('No changes to package files, skipping post-update options');
    return null;
  }

  const options = coerceArray(config.postUpdateOptions);

  const supportedOptions = [
    'gomodTidy',
    'gomodTidy1.17',
    'gomodTidyE',
    'gomodTidyAll',
    'gomodUpdateImportPaths',
  ];

  const hasSupportedOptions = options.some((option) =>
    supportedOptions.includes(option),
  );

  if (!hasSupportedOptions) {
    return null;
  }

  logger.debug({ options }, 'Executing post-update options');

  const updatedFiles = [
    ...coerceArray(config.updatedPackageFiles),
    ...coerceArray(config.updatedArtifacts),
  ];

  await writeUpdatedFiles(updatedFiles);

  const result = await executeGoModTidy(config);

  if (!result) {
    return null;
  }

  return {
    updatedArtifacts: mergeFileChanges(
      coerceArray(config.updatedArtifacts),
      coerceArray(result.updatedArtifacts),
    ),
    artifactErrors: [
      ...coerceArray(config.artifactErrors),
      ...coerceArray(result.artifactErrors),
    ],
  };
}
