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
  const defaultSourceFile = outputFileName.replace('.txt', '.in');
  try {
    const pipCompileArgs = extractHeaderCommand(content, outputFileName);
    if (strict && pipCompileArgs.isCustomCommand) {
      logger.error({ command: pipCompileArgs.command }, 'Custom command');
    }
    const newCmd = [];
    if (!pipCompileArgs.command || pipCompileArgs.command === '') {
      logger.trace('No command detected, assuming pip-compile');
      newCmd.push('pip-compile');
    }
    // if (pipCompileArgs.sourceFiles.length === 0) {
    //   logger.warn('Assuming implicit source file of requirements.in');
    //   pipCompileArgs.sourceFiles.push('requirements.in'); // implicit
    //   pipCompileArgs.argv.push('requirements.in'); // TODO(not7cd): dedup
    // }
    // TODO(not7cd): sanitize args that require quotes, .map((argument) => quote(argument))
    return pipCompileArgs.argv.join(' ');
  } catch (error) {
    return `pip-compile ${defaultSourceFile}`;
  }
}

export async function updateArtifacts({
  packageFileName: inputFileName,
  newPackageFileContent: newInputContent,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (!config.lockFiles) {
    logger.error(`No lock files associated with ${inputFileName}`);
    return null;
  }
  // TODO(not7cd): for each
  const outputFileName = config.lockFiles[0];
  logger.debug(
    `pipCompile.updateArtifacts(${inputFileName}->${outputFileName})`,
  );
  const existingOutput = await readLocalFile(outputFileName, 'utf8');
  if (!existingOutput) {
    logger.debug('No pip-compile output file found');
    return null;
  }
  try {
    await writeLocalFile(inputFileName, newInputContent);
    // TODO(not7cd): check --rebuild and --upgrade option
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
    logger.debug('Returning updated pip-compile result');
    return [
      {
        file: {
          type: 'addition',
          path: outputFileName,
          contents: await readLocalFile(outputFileName, 'utf8'),
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to pip-compile');
    return [
      {
        artifactError: {
          lockFile: outputFileName,
          stderr: err.message,
        },
      },
    ];
  }
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
