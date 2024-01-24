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
const dummyPipCompile = new Command()
  .option('-o, --output-file <path>')
  // .option('--no-emit-index-url')
  .option('--extra-index-url')
  // .enablePositionalOptions()
  .allowUnknownOption()
  .allowExcessArguments();

interface PipCompileArgs {
  command: string;
  output?: string;
  extra?: string[];
  constraint?: string[];
  sourceFiles: string[]; // positional arguments
  fullCommand: string; // parsed and reconstructed
}

// TODO(not7cd): test on all correct headers, even with CUSTOM_COMPILE_COMMAND
export function extractHeaderCommand(
  content: string,
  outputFileName: string,
): PipCompileArgs {
  const compileCommand = constraintLineRegex.exec(content);
  if (compileCommand?.groups) {
    logger.debug(`Found pip-compile header: ${compileCommand[0]}`);
  } else {
    logger.error('Failed to extract command from header');
    // TODO(not7cd): throw
  }
  const _fullCommand = [];
  const pipCompileArgs: PipCompileArgs = {
    fullCommand: '',
    command: '',
    sourceFiles: [],
  };
  if (compileCommand?.groups) {
    const argv = [compileCommand.groups.command];
    // all arguments are optional, TODO(not7cd): decide if require explicit args
    if (compileCommand.groups.arguments) {
      argv.push(...split(compileCommand.groups.arguments));
    }
    try {
      const isCustomCommand = argv[0] !== 'pip-compile';
      const parsedCommand = dummyPipCompile.parse(argv);
      const options = parsedCommand.opts();
      const args = parsedCommand.args;
      logger.debug(
        { argv, options, srcFiles: args, isCustomCommand },
        'Parsed pip-compile command from header',
      );
      if (args.length === 0) {
        logger.debug('Assuming impicit source file of requirements.in');
        pipCompileArgs.sourceFiles.push('requirements.in'); // implicit
      } else {
        pipCompileArgs.sourceFiles.push(...args);
      }
    } catch (error) {
      logger.error(
        error,
        'Failed to parse pip-compile command from header with commander',
      );
    }
  }

  // TODO(not7cd)
  if (false && compileCommand?.groups) {
    const command = compileCommand.groups.command;
    _fullCommand.push(command);
    for (const argument of split(compileCommand.groups.arguments)) {
      if (argument.startsWith('--output-file=') || argument.startsWith('-o=')) {
        const value = argument.split('=')[1];
        if (value) {
          // TODO(not7cd): This file path can be relative like `reqs/main.txt`
          const file = upath.parse(outputFileName).base;
          if (value !== file) {
            // we don't trust the user-supplied output-file argument; TODO(not7cd): use our value here
            logger.warn(
              { argument },
              'pip-compile was previously executed with an unexpected `--output-file` filename',
            );
          }
          pipCompileArgs.output = value;
        }
      } else if (argument.startsWith('--')) {
        logger.trace(
          { argument },
          'pip-compile argument is not (yet) supported',
        );
      } else {
        // TODO(not7cd): get position arguments and infer original files
        pipCompileArgs.sourceFiles.push(argument);
      }
      _fullCommand.push(argument);
    }
    pipCompileArgs.fullCommand = _fullCommand.join(' ');
    return pipCompileArgs;
  }
  // args.push(upath.parse(inputFileName).base);
  logger.trace({ compileCommand }, 'Failed to parse command');
  return pipCompileArgs;
}
