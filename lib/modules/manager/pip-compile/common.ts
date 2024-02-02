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
  '--resolver',
];
export const allowedPipOptions = [
  '-v',
  '--allow-unsafe',
  '--generate-hashes',
  '--no-emit-index-url', // TODO: handle this!!!
  '--strip-extras',
  ...optionsWithArguments,
];

// as commander.js is already used, we will reuse it's argument parsing capability
const dummyPipCompile = new Command();
dummyPipCompile
  .argument('[sourceFile...]') // optional, so extractHeaderCommand can throw an explicit error
  .option('--output-file <path>')
  .option('--extra <extra...>')
  .option('--extra-index-url <url...>')
  .allowUnknownOption();

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
  fileName: string,
): PipCompileArgs {
  const strict: boolean = true; // TODO(not7cd): add to function params
  const compileCommand = constraintLineRegex.exec(content);
  if (compileCommand?.groups === undefined) {
    throw new Error(`Failed to extract command from header in ${fileName}`);
  }
  logger.debug(
    `pip-compile: found header in ${fileName}: \n${compileCommand[0]}`,
  );
  const command = compileCommand.groups.command;
  const argv: string[] = [command];
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
  // workaround, not sure how Commander returns named arguments
  const sourceFiles = parsedCommand.args.filter((arg) => !arg.startsWith('-'));
  logger.trace(
    {
      argv,
      options,
      sourceFiles,
      isCustomCommand,
    },
    'Parsed pip-compile command from header',
  );
  if (sourceFiles.length === 0) {
    throw new Error(
      'No source files detected in command, pass at least one package file explicitly',
    );
  }
  let outputFile = '';
  if (options.outputFile) {
    // TODO(not7cd): This file path can be relative like `reqs/main.txt`
    const file = upath.parse(fileName).base;
    if (options.outputFile === file) {
      outputFile = options.outputFile;
    } else {
      // we don't trust the user-supplied output-file argument;
      // TODO(not7cd): allow relative paths
      logger.warn(
        { outputFile: options.outputFile, actualPath: file },
        'pip-compile was previously executed with an unexpected `--output-file` filename',
      );
      // TODO(not7cd): this shouldn't be changed in extract function
      outputFile = file;
      argv.forEach((item, i) => {
        if (item.startsWith('--output-file=')) {
          argv[i] = `--output-file=${file}`;
        }
      });
    }
  } else {
    logger.debug(`pip-compile: implicit output file (${fileName})`);
  }
  return {
    argv,
    command,
    isCustomCommand,
    outputFile,
    sourceFiles,
  };
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
    if (arg === option) {
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
