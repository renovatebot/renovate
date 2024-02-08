import is from '@sindresorhus/is';
import { quote, split } from 'shlex';
import upath from 'upath';
import { logger } from '../../../logger';
import type { ExecOptions } from '../../../util/exec/types';
import { ensureCacheDir } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { UpdateArtifactsConfig } from '../types';
import type { PipCompileArgs } from './types';

export function getPythonConstraint(
  config: UpdateArtifactsConfig,
): string | undefined | null {
  const { constraints = {} } = config;
  const { python } = constraints;

  if (python) {
    logger.debug('Using python constraint from config');
    return python;
  }

  return undefined;
}
// TODO(not7cd): rename to getPipToolsVersionConstraint, as constraints have their meaning in pip
export function getPipToolsConstraint(config: UpdateArtifactsConfig): string {
  const { constraints = {} } = config;
  const { pipTools } = constraints;

  if (is.string(pipTools)) {
    logger.debug('Using pipTools constraint from config');
    return pipTools;
  }

  return '';
}
export async function getExecOptions(
  config: UpdateArtifactsConfig,
  inputFileName: string,
): Promise<ExecOptions> {
  const constraint = getPythonConstraint(config);
  const pipToolsConstraint = getPipToolsConstraint(config);
  const execOptions: ExecOptions = {
    cwdFile: inputFileName,
    docker: {},
    toolConstraints: [
      {
        toolName: 'python',
        constraint,
      },
      {
        toolName: 'pip-tools',
        constraint: pipToolsConstraint,
      },
    ],
    extraEnv: {
      PIP_CACHE_DIR: await ensureCacheDir('pip'),
    },
  };
  return execOptions;
}

export const constraintLineRegex = regEx(
  /^(#.*?\r?\n)+# {4}(?<command>\S*)(?<arguments> .*?)?\r?\n/,
);

export const disallowedPipOptions = [
  '--no-header', // header is required by this manager
];
export const optionsWithArguments = [
  '--output-file',
  '--extra',
  '--extra-index-url',
  '--resolver',
  '--constraint',
];
export const allowedPipOptions = [
  '-v',
  '--allow-unsafe',
  '--generate-hashes',
  '--no-emit-index-url',
  '--emit-index-url',
  '--strip-extras',
  '--index-url',
  // ...optionsWithArguments,
];

// TODO(not7cd): test on all correct headers, even with CUSTOM_COMPILE_COMMAND
export function extractHeaderCommand(
  content: string,
  fileName: string,
): PipCompileArgs {
  const strict: boolean = true; // TODO(not7cd): add to function params
  const compileCommand = constraintLineRegex.exec(content);
  if (compileCommand?.groups === undefined) {
    throw new Error(`Failed to extract command from header in ${fileName}`);
  }
  logger.trace(
    `pip-compile: found header in ${fileName}: \n${compileCommand[0]}`,
  );
  const command = compileCommand.groups.command;
  const argv = [command];
  const isCustomCommand = command !== 'pip-compile';
  if (isCustomCommand) {
    logger.debug(
      `pip-compile: custom command ${command} detected (${fileName})`,
    );
  }
  if (compileCommand.groups.arguments) {
    argv.push(...split(compileCommand.groups.arguments));
  }
  logger.debug(
    `pip-compile: extracted command from header: ${JSON.stringify(argv)}`,
  );

  const result: PipCompileArgs = {
    argv,
    command,
    isCustomCommand,
    outputFile: '',
    sourceFiles: [],
  };
  // const options: Record<string, string | string[] | boolean> = {};
  for (const arg of argv.slice(1)) {
    // TODO(not7cd): check for "--option -- argument" case
    if (!arg.startsWith('-')) {
      result.sourceFiles.push(arg);
      continue;
    }
    throwForDisallowedOption(arg);
    throwForNoEqualSignInOptionWithArgument(arg);
    if (strict) {
      throwForUnknownOption(arg);
    }

    if (arg.includes('=')) {
      const [option, value] = arg.split('=');
      if (option === '--extra') {
        result.extra = result.extra ?? [];
        result.extra.push(value);
      } else if (option === '--extra-index-url') {
        result.extraIndexUrl = result.extraIndexUrl ?? [];
        result.extraIndexUrl.push(value);
        // TODO: add to secrets? next PR
      } else if (option === '--constraint') {
        result.constraintsFiles = result.constraintsFiles ?? [];
        result.constraintsFiles.push(value);
      } else if (option === '--output-file') {
        result.outputFile = value;
      } else if (option === '--index-url') {
        result.indexUrl = value;
        // TODO: add to secrets? next PR
      } else {
        logger.warn(`pip-compile: option ${arg} not handled`);
      }
      continue;
    }
    if (arg === '--no-emit-index-url') {
      result.noEmitIndexUrl = true;
      continue;
    }
    if (arg === '--emit-index-url') {
      result.emitIndexUrl = true;
      continue;
    }

    logger.warn(`pip-compile: option ${arg} not handled`);
  }

  logger.trace(
    {
      ...result,
    },
    'Parsed pip-compile command from header',
  );
  if (result.noEmitIndexUrl && result.emitIndexUrl) {
    throw new Error('Cannot use both --no-emit-index-url and --emit-index-url');
  }
  if (result.sourceFiles.length === 0) {
    throw new Error(
      'No source files detected in command, pass at least one package file explicitly',
    );
  }
  if (result.outputFile) {
    // TODO(not7cd): This file path can be relative like `reqs/main.txt`
    const file = upath.parse(fileName).base;
    if (result.outputFile !== file) {
      // we don't trust the user-supplied output-file argument;
      // TODO(not7cd): allow relative paths
      logger.warn(
        { outputFile: result.outputFile, actualPath: file },
        'pip-compile was previously executed with an unexpected `--output-file` filename',
      );
      // TODO(not7cd): this shouldn't be changed in extract function
      result.outputFile = file;
      argv.forEach((item, i) => {
        if (item.startsWith('--output-file=')) {
          argv[i] = `--output-file=${quote(file)}`;
        }
      });
    }
  } else {
    logger.debug(`pip-compile: implicit output file (${fileName})`);
  }
  return result;
}

function throwForDisallowedOption(arg: string): void {
  if (disallowedPipOptions.includes(arg)) {
    throw new Error(`Option ${arg} not allowed for this manager`);
  }
}

function throwForNoEqualSignInOptionWithArgument(arg: string): void {
  // this won't match if there is `=` at the end of the string
  if (optionsWithArguments.includes(arg)) {
    throw new Error(
      `Option ${arg} must have equal sign '=' separating it's argument`,
    );
  }
}

function throwForUnknownOption(arg: string): void {
  if (arg.includes('=')) {
    const [option] = arg.split('=');
    if (allowedPipOptions.includes(option)) {
      return;
    }
  }
  if (allowedPipOptions.includes(arg)) {
    return;
  }
  throw new Error(`Option ${arg} not supported (yet)`);
}
