import is from '@sindresorhus/is';
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
  /^(#.*?\r?\n)+# {4}(?<command>\S*)(?<arguments> .*?)\r?\n/,
);
export const allowedPipArguments = [
  '--allow-unsafe',
  '--generate-hashes',
  '--no-emit-index-url', // handle this!!!
  '--strip-extras',
];

interface PipCompileArgs {
  command: string;
  output?: string;
  extra?: string[];
  constraint?: string[];
  sourceFiles: string[]; // positional arguments
  fullCommand: string; // parsed and reconstructed
}

export function extractHeaderCommand(
  content: string,
  outputFileName: string,
): PipCompileArgs {
  const compileCommand = constraintLineRegex.exec(content);
  const _fullCommand = [];
  const pipCompileArgs: PipCompileArgs = {
    fullCommand: '',
    command: '',
    sourceFiles: [],
  };
  if (compileCommand?.groups) {
    const command = compileCommand.groups.command;
    _fullCommand.push(command);
    logger.debug(`Found pip-compile header: ${compileCommand[0]}`);
    for (const argument of split(compileCommand.groups.arguments)) {
      if (argument.startsWith('--output-file=') || argument.startsWith('-o=')) {
        const value = argument.split('=')[1];
        if (value) {
          const file = upath.parse(outputFileName).base;
          if (value !== file) {
            // we don't trust the user-supplied output-file argument; use our value here
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
}
