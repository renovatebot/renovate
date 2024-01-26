import is from '@sindresorhus/is';
import { Command } from 'commander';
import { split } from 'shlex';
import upath from 'upath';
import { logger } from '../../../logger';
import type { ExecOptions } from '../../../util/exec/types';
import { ensureCacheDir } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { UpdateArtifactsConfig } from '../types';

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
} // TODO(not7cd): rename to getPipToolsVersionConstraint, as constraints have their meaning in pipexport function extractHeaderCommand(content: string): string {

export const constraintLineRegex = regEx(
  /^(#.*?\r?\n)+# {4}(?<command>\S*)(?<arguments> .*?)?\r?\n/,
);
export const allowedPipArguments = [
  '--allow-unsafe',
  '--generate-hashes',
  '--no-emit-index-url', // handle this!!!
  '--strip-extras',
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
): PipCompileArgs {
  const compileCommand = constraintLineRegex.exec(content);
  if (compileCommand?.groups) {
    logger.debug(
      `Found pip-compile header in ${outputFileName}: \n${compileCommand[0]}`,
    );
  } else {
    logger.error(`Failed to extract command from header in ${outputFileName}`);
    // TODO(not7cd): throw
  }
  const pipCompileArgs: PipCompileArgs = {
    argv: [],
    command: '',
    sourceFiles: [],
  };
  if (compileCommand?.groups) {
    pipCompileArgs.argv = [compileCommand.groups.command];
    // all arguments are optional, TODO(not7cd): decide if require explicit args
    if (compileCommand.groups.arguments) {
      pipCompileArgs.argv.push(...split(compileCommand.groups.arguments));
    }
    logger.debug(
      { argv: pipCompileArgs.argv },
      'Extracted pip-compile command from header',
    );
    try {
      const isCustomCommand = pipCompileArgs.argv[0] !== 'pip-compile';
      const parsedCommand = dummyPipCompile.parse(
        // parse is expecting argv[0] to be process.execPath
        [''].concat(pipCompileArgs.argv),
      );
      const options = parsedCommand.opts();
      // TODO(not7cd): trace unsupported options
      pipCompileArgs.sourceFiles = parsedCommand.args;
      logger.debug(
        {
          argv: pipCompileArgs.argv,
          options,
          sourceFiles: pipCompileArgs.sourceFiles,
          args: parsedCommand.args,
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
        pipCompileArgs.outputFile = options.outputFile;
      }
    } catch (error) {
      logger.error(
        error,
        'Failed to parse pip-compile command from header with commander',
      );
    }
    return pipCompileArgs;
  }
  logger.trace({ compileCommand }, 'Failed to parse command');
  return pipCompileArgs;
}
