import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  deleteLocalFile,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { extractHeaderCommand, getExecOptions } from './common';

export function constructPipCompileCmd(
  content: string,
  outputFileName: string,
  strict: boolean = true,
): string {
  const pipCompileArgs = extractHeaderCommand(content, outputFileName);
  if (strict && pipCompileArgs.isCustomCommand) {
    throw new Error(
      'Detected custom command, header modified or set by CUSTOM_COMPILE_COMMAND',
    );
  }
  return pipCompileArgs.argv.map(quote).join(' ');
}

export async function updateArtifacts({
  packageFileName: inputFileName,
  newPackageFileContent: newInputContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (!config.lockFiles) {
    logger.warn(
      { packageFileName: inputFileName },
      'No lock files associated with a package file',
    );
    return null;
  }
  logger.debug(
    `pipCompile.updateArtifacts(${inputFileName}->${JSON.stringify(
      config.lockFiles,
    )})`,
  );
  const result: UpdateArtifactsResult[] = [];
  for (const outputFileName of config.lockFiles) {
    const existingOutput = await readLocalFile(outputFileName, 'utf8');
    if (!existingOutput) {
      logger.debug('No pip-compile output file found');
      return null;
    }
    try {
      await writeLocalFile(inputFileName, newInputContent);
      // TODO(not7cd): use --upgrade option instead deleting
      if (config.isLockFileMaintenance) {
        await deleteLocalFile(outputFileName);
      }
      const cmd = constructPipCompileCmd(existingOutput, outputFileName);
      const execOptions: ExecOptions = await getExecOptions(
        config,
        inputFileName,
      );
      logger.trace({ cmd }, 'pip-compile command');
      await exec(cmd, execOptions);
      const status = await getRepoStatus();
      if (!status?.modified.includes(outputFileName)) {
        return null;
      }
      result.push({
        file: {
          type: 'addition',
          path: outputFileName,
          contents: await readLocalFile(outputFileName, 'utf8'),
        },
      });
    } catch (err) {
      // istanbul ignore if
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.debug({ err }, 'Failed to pip-compile');
      result.push({
        artifactError: {
          lockFile: outputFileName,
          stderr: err.message,
        },
      });
    }
  }
  logger.debug('Returning updated pip-compile result');
  return result;
}

// TODO(not7cd): remove, legacy resolver is deprecated and will be removed
export function extractResolver(argument: string): string | null {
  const value = argument.replace('--resolver=', '');
  if (['backtracking', 'legacy'].includes(value)) {
    return value;
  }

  logger.warn(
    { argument },
    'pip-compile was previously executed with an unexpected `--resolver` value',
  );
  return null;
}
