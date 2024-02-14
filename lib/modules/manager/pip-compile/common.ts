import is from '@sindresorhus/is';
import { split } from 'shlex';
import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import type { ExecOptions } from '../../../util/exec/types';
import { ensureCacheDir } from '../../../util/fs';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import type { PackageFileContent, UpdateArtifactsConfig } from '../types';
import type {
  DependencyBetweenFiles,
  GetRegistryUrlVarsResult,
  PipCompileArgs,
} from './types';

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
  extraEnv: Record<string, string>,
): Promise<ExecOptions> {
  const constraint = getPythonConstraint(config);
  const pipToolsConstraint = getPipToolsConstraint(config);
  const execOptions: ExecOptions = {
    cwdFile: inputFileName,
    docker: {},
    userConfiguredEnv: config.env,
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
      ...extraEnv,
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
  ...optionsWithArguments,
];

// TODO(not7cd): test on all correct headers, even with CUSTOM_COMPILE_COMMAND
export function extractHeaderCommand(
  content: string,
  fileName: string,
): PipCompileArgs {
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
  for (const arg of argv.slice(1)) {
    // TODO(not7cd): check for "--option -- argument" case
    if (!arg.startsWith('-')) {
      result.sourceFiles.push(arg);
      continue;
    }
    throwForDisallowedOption(arg);
    throwForNoEqualSignInOptionWithArgument(arg);
    throwForUnknownOption(arg);

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
        if (result.outputFile) {
          throw new Error('Cannot use multiple --output-file options');
        }
        result.outputFile = value;
      } else if (option === '--index-url') {
        if (result.indexUrl) {
          throw new Error('Cannot use multiple --index-url options');
        }
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
  return result;
}

function throwForDisallowedOption(arg: string): void {
  if (disallowedPipOptions.includes(arg)) {
    throw new Error(`Option ${arg} not allowed for this manager`);
  }
}
function throwForNoEqualSignInOptionWithArgument(arg: string): void {
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

export function generateMermaidGraph(
  depsBetweenFiles: DependencyBetweenFiles[],
  lockFileArgs: Map<string, PipCompileArgs>,
): string {
  const lockFiles = [];
  for (const lockFile of lockFileArgs.keys()) {
    // TODO: add extra args to the lock file ${extraArgs ? '\n' + extraArgs : ''}
    // const extraArgs = pipCompileArgs.extra
    //   ?.map((v) => '--extra=' + v)
    //   .join('\n');
    lockFiles.push(`  ${lockFile}[[${lockFile}]]`);
  }
  const edges = depsBetweenFiles.map(({ sourceFile, outputFile, type }) => {
    return `  ${sourceFile} -${type === 'constraint' ? '.' : ''}-> ${outputFile}`;
  });
  return `graph TD\n${lockFiles.join('\n')}\n${edges.join('\n')}`;
}

function buildRegistryUrl(url: string): URL | null {
  try {
    const ret = new URL(url);
    const hostRule = hostRules.find({ url });
    if (!ret.username && !ret.password) {
      ret.username = hostRule.username ?? '';
      ret.password = hostRule.password ?? '';
    }
    return ret;
  } catch {
    return null;
  }
}

function getRegistryUrlVarFromUrls(
  varName: keyof GetRegistryUrlVarsResult['environmentVars'],
  urls: URL[],
): GetRegistryUrlVarsResult {
  if (!urls.length) {
    return {
      haveCredentials: false,
      environmentVars: {},
    };
  }

  let haveCredentials = false;
  for (const url of urls) {
    if (url.username || url.password) {
      haveCredentials = true;
    }
  }
  const registryUrlsString = urls.map((url) => url.href).join(' ');
  const ret: GetRegistryUrlVarsResult = {
    haveCredentials,
    environmentVars: {},
  };
  if (registryUrlsString) {
    ret.environmentVars[varName] = registryUrlsString;
  }
  return ret;
}

export function getRegistryUrlVarsFromPackageFile(
  packageFile: PackageFileContent | null,
): GetRegistryUrlVarsResult {
  // There should only ever be one element in registryUrls, since pip_requirements gets them from --index-url
  // flags in the input file, and that only makes sense once
  const indexUrl = getRegistryUrlVarFromUrls(
    'PIP_INDEX_URL',
    packageFile?.registryUrls
      ?.map(buildRegistryUrl)
      .filter(isNotNullOrUndefined) ?? [],
  );
  const extraIndexUrls = getRegistryUrlVarFromUrls(
    'PIP_EXTRA_INDEX_URL',
    packageFile?.additionalRegistryUrls
      ?.map(buildRegistryUrl)
      .filter(isNotNullOrUndefined) ?? [],
  );

  return {
    haveCredentials: indexUrl.haveCredentials || extraIndexUrls.haveCredentials,
    environmentVars: {
      ...indexUrl.environmentVars,
      ...extraIndexUrls.environmentVars,
    },
  };
}
