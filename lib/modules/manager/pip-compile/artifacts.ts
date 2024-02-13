import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import {
  deleteLocalFile,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { ensureLocalPath } from '../../../util/fs/util';
import { getRepoStatus } from '../../../util/git';
import * as pipRequirements from '../pip_requirements';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import {
  extractHeaderCommand,
  getExecOptions,
  getRegistryUrlVarsFromPackageFile,
} from './common';

interface PipCompileCmd {
  cwd: string;
  cmd: string;
}

export function constructPipCompileCmd(
  content: string,
  outputFileName: string,
  haveCredentials: boolean,
): PipCompileCmd {
  const headerArguments = extractHeaderCommand(content, outputFileName);
  if (headerArguments.isCustomCommand) {
    throw new Error(
      'Detected custom command, header modified or set by CUSTOM_COMPILE_COMMAND',
    );
  }
  const compileDir: string = headerArguments.commandExecDir;
  // should never happen as we already checked for this in extractAllPackageFiles
  ensureLocalPath(compileDir);

  if (!headerArguments.outputFile) {
    logger.debug({ outputFileName }, `pip-compile: implicit output file`);
  }
  // safeguard against index url leak if not explicitly set by an option
  if (
    (!headerArguments.noEmitIndexUrl && !headerArguments.emitIndexUrl) ||
    (!headerArguments.noEmitIndexUrl && haveCredentials)
  ) {
    headerArguments.argv.splice(1, 0, '--no-emit-index-url');
  }
  return { cwd: compileDir, cmd: headerArguments.argv.map(quote).join(' ') };
}

export async function updateArtifacts({
  packageFileName: inputFileName,
  newPackageFileContent: newInputContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (!config.lockFiles) {
    logger.warn(
      { packageFileName: inputFileName },
      'pip-compile: No lock files associated with a package file',
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
      logger.debug('pip-compile: No output file found');
      return null;
    }
    try {
      await writeLocalFile(inputFileName, newInputContent);
      // TODO(not7cd): use --upgrade option instead deleting
      if (config.isLockFileMaintenance) {
        await deleteLocalFile(outputFileName);
      }
      const packageFile = pipRequirements.extractPackageFile(newInputContent);
      const registryUrlVars = getRegistryUrlVarsFromPackageFile(packageFile);
      const { cwd, cmd } = constructPipCompileCmd(
        existingOutput,
        outputFileName,
        registryUrlVars.haveCredentials,
      );
      const execOptions = await getExecOptions(
        config,
        cwd,
        registryUrlVars.environmentVars,
      );
      logger.trace({ cwd, cmd }, 'pip-compile command');
      logger.trace({ env: execOptions.extraEnv }, 'pip-compile extra env vars');
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
      logger.debug({ err }, 'pip-compile: Failed to run command');
      result.push({
        artifactError: {
          lockFile: outputFileName,
          stderr: err.message,
        },
      });
    }
  }
  logger.debug('pip-compile: Returning updated output file(s)');
  return result;
}
