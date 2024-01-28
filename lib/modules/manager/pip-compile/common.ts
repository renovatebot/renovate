import is from '@sindresorhus/is';
import { Command } from 'commander';
import { split } from 'shlex';
import upath from 'upath';
import { logger } from '../../../logger';
import type { ExecOptions } from '../../../util/exec/types';
import { ensureCacheDir } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { UpdateArtifactsConfig } from '../types';

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
];
export const allowedPipOptions = [
  '--allow-unsafe',
  '--generate-hashes',
  '--no-emit-index-url', // TODO: handle this!!!
  '--strip-extras',
  ...optionsWithArguments,
];

// as commander.js is already used, we will reuse it's argument parsing capability
const dummyPipCompile = new Command();
dummyPipCompile
  .argument('<sourceFile...>')
  .option('-o, --output-file <path>')
  // .option('--no-emit-index-url')
  .option('--extra-index-url <url...>')
  .allowUnknownOption();
// .allowExcessArguments()

interface PipCompileArgs {
  command: string;
  isCustomCommand: boolean;
  outputFile?: string;
  extra?: string[];
  constraint?: string[];
  sourceFiles: string[]; // positional arguments
  argv: string[]; // all arguments as a list
}

// TODO(not7cd): test on all correct headers, even with CUSTOM_COMPILE_COMMAND
export function extractHeaderCommand(
  content: string,
  outputFileName: string,
): PipCompileArgs | null {
  const strict: boolean = true; // TODO(not7cd): add to function params
  const compileCommand = constraintLineRegex.exec(content);
  if (compileCommand?.groups) {
    logger.debug(
      `Found pip-compile header in ${outputFileName}: \n${compileCommand[0]}`,
    );
  } else {
    throw new Error(
      `Failed to extract command from header in ${outputFileName}`,
    );
  }
  if (compileCommand?.groups) {
    try {
      const command = compileCommand.groups.command;
      const argv: string[] = [command];
      const isCustomCommand = command !== 'pip-compile';
      if (strict && isCustomCommand) {
        throw new Error(
          `Command "${command}" != "pip-compile", header modified or set by CUSTOM_COMPILE_COMMAND`,
        );
      }
      if (isCustomCommand) {
        logger.debug(`Custom command ${command} detected`);
      }
      if (compileCommand.groups.arguments) {
        argv.push(...split(compileCommand.groups.arguments));
      }
      logger.debug({ argv }, 'Extracted pip-compile command from header');
      for (const arg of argv) {
        // TODO(not7cd): check for "--option -- argument" case
        if (!arg.startsWith('-')) {
          continue;
        }
        throwForDisallowedOption(arg);
        throwForNoEqualSignInOptionWithArgument(arg);
        if (strict) {
          throwForUnknownOption(arg);
        }
      }

      // Commander.parse is expecting argv[0] to be process.execPath, pass empty string as first value
      const parsedCommand = dummyPipCompile.parse(['', ...argv]);
      const options = parsedCommand.opts();
      const sourceFiles = parsedCommand.args;
      logger.debug(
        {
          argv,
          options,
          sourceFiles,
          isCustomCommand,
        },
        'Parsed pip-compile command from header',
      );
      if (options.outputFile) {
        // TODO(not7cd): This file path can be relative like `reqs/main.txt`
        const file = upath.parse(outputFileName).base;
        if (options.outputFile !== file) {
          // we don't trust the user-supplied output-file argument; TODO(not7cd): use our value here
          logger.warn(
            { outputFile: options.outputFile, actualPath: file },
            'pip-compile was previously executed with an unexpected `--output-file` filename',
          );
        }
        const outputFile = options.outputFile;
        return {
          argv,
          command,
          isCustomCommand,
          outputFile,
          sourceFiles,
        };
      }
    } catch (error) {
      logger.error(
        error,
        'Failed to parse pip-compile command from header with commander',
      );
    }
  }
  logger.trace({ compileCommand }, 'Failed to parse command');
  return null;
}

function throwForDisallowedOption(arg: string): void {
  for (const disallowedPipOption of disallowedPipOptions) {
    if (arg.startsWith(disallowedPipOption)) {
      throw new Error(
        `Option ${disallowedPipOption} not allowed for this manager`,
      );
    }
  }
}

function throwForNoEqualSignInOptionWithArgument(arg: string): void {
  for (const option of optionsWithArguments) {
    if (arg.startsWith(option) && !arg.startsWith(`${option}=`)) {
      throw new Error(
        `Option ${option} must have equal sign '=' separating it's argument`,
      );
    }
  }
}

function throwForUnknownOption(arg: string): void {
  for (const allowedOption of allowedPipOptions) {
    if (arg.startsWith(allowedOption)) {
      return;
    }
  }
  throw new Error(`Option ${arg} not supported (yet)`);
}
