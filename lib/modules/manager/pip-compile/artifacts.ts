import { quote, split } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import {
  deleteLocalFile,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { regEx } from '../../../util/regex';
import * as pipRequirements from '../pip_requirements';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import {
  constraintLineRegex,
  deprecatedAllowedPipArguments,
  getExecOptions,
  getRegistryUrlVarsFromPackageFile,
} from './common';

export function constructPipCompileCmd(
  content: string,
  inputFileName: string,
  outputFileName: string,
  haveCredentials: boolean,
): string {
  const headers = constraintLineRegex.exec(content);
  const args = ['pip-compile'];
  if (!!headers?.groups || haveCredentials) {
    logger.debug(`Found pip-compile header: ${headers?.[0]}`);
    const headerArguments = split(headers?.groups?.arguments ?? '');
    if (haveCredentials && !headerArguments.includes('--no-emit-index-url')) {
      headerArguments.push('--no-emit-index-url');
    }
    for (const argument of headerArguments) {
      if (deprecatedAllowedPipArguments.includes(argument)) {
        args.push(argument);
      } else if (argument.startsWith('--output-file=')) {
        const file = upath.parse(outputFileName).base;
        if (argument !== `--output-file=${file}`) {
          // we don't trust the user-supplied output-file argument; use our value here
          logger.warn(
            { argument },
            'pip-compile was previously executed with an unexpected `--output-file` filename',
          );
        }
        args.push(`--output-file=${file}`);
      } else if (argument.startsWith('--resolver=')) {
        const value = extractResolver(argument);
        if (value) {
          args.push(`--resolver=${value}`);
        }
      } else if (argument.startsWith('--')) {
        logger.trace(
          { argument },
          'pip-compile argument is not (yet) supported',
        );
      } else {
        // ignore position argument (.in file)
      }
    }
  }
  args.push(upath.parse(inputFileName).base);

  return args.map((argument) => quote(argument)).join(' ');
}

export async function updateArtifacts({
  packageFileName: inputFileName,
  newPackageFileContent: newInputContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const outputFileName = inputFileName.replace(regEx(/(\.in)?$/), '.txt');
  config.lockFiles = [outputFileName];
  // TODO: remove above and below line and use config.lockFiles directly in the next PR
  // istanbul ignore if
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
      const cmd = constructPipCompileCmd(
        existingOutput,
        inputFileName,
        outputFileName,
        registryUrlVars.haveCredentials,
      );
      const execOptions = await getExecOptions(
        config,
        inputFileName,
        registryUrlVars.environmentVars,
      );
      logger.trace({ cmd }, 'pip-compile command');
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
