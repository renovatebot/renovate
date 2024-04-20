import is from '@sindresorhus/is';
import { split } from 'shlex';
import upath from 'upath';
import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import type { ExecOptions, ExtraEnv } from '../../../util/exec/types';
import { ensureCacheDir } from '../../../util/fs';
import { ensureLocalPath } from '../../../util/fs/util';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import type { PackageFileContent, UpdateArtifactsConfig } from '../types';
import type { PipCompileArgs } from './types';

export function getPythonVersionConstraint(
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
export function getPipToolsVersionConstraint(
  config: UpdateArtifactsConfig,
): string {
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
  cwd: string,
  extraEnv: ExtraEnv<string>,
): Promise<ExecOptions> {
  const constraint = getPythonVersionConstraint(config);
  const pipToolsConstraint = getPipToolsVersionConstraint(config);
  const execOptions: ExecOptions = {
    cwd: ensureLocalPath(cwd),
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
      PIP_NO_INPUT: 'true', // ensure pip doesn't block forever waiting for credentials on stdin
      PIP_KEYRING_PROVIDER: 'import',
      PYTHON_KEYRING_BACKEND: 'keyrings.envvars.keyring.EnvvarsKeyring',
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
  '--all-extras',
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
    throw new Error(
      `Failed to extract command from header in ${fileName} ${content}`,
    );
  }
  logger.trace(
    `pip-compile: found header in ${fileName}: \n${compileCommand[0]}`,
  );
  const command = compileCommand.groups.command;
  const argv = [command];
  const isCustomCommand = command !== 'pip-compile';
  if (compileCommand.groups.arguments) {
    argv.push(...split(compileCommand.groups.arguments));
  }
  logger.debug(
    { fileName, argv, isCustomCommand },
    `pip-compile: extracted command from header`,
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
        result.outputFile = upath.normalize(value);
      } else if (option === '--index-url') {
        if (result.indexUrl) {
          throw new Error('Cannot use multiple --index-url options');
        }
        result.indexUrl = value;
        // TODO: add to secrets? next PR
      } else {
        logger.debug({ option }, `pip-compile: option not handled`);
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
    if (arg === '--all-extras') {
      result.allExtras = true;
      continue;
    }

    logger.debug({ option: arg }, `pip-compile: option not handled`);
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

function getRegistryCredEnvVars(
  url: URL,
  index: number,
): Record<string, string> {
  const hostRule = hostRules.find({ url: url.href });
  logger.debug(hostRule, `Found host rule for url ${url.href}`);
  const ret: Record<string, string> = {};
  if (!!hostRule.username || !!hostRule.password) {
    ret[`KEYRING_SERVICE_NAME_${index}`] = url.hostname;
    ret[`KEYRING_SERVICE_USERNAME_${index}`] = hostRule.username ?? '';
    ret[`KEYRING_SERVICE_PASSWORD_${index}`] = hostRule.password ?? '';
  }
  return ret;
}

function cleanUrl(url: string): URL | null {
  try {
    // Strip everything but protocol, host, and port
    const urlObj = new URL(url);
    return new URL(urlObj.origin);
  } catch {
    return null;
  }
}

export function getRegistryCredVarsFromPackageFile(
  packageFile: PackageFileContent | null,
): ExtraEnv<string> {
  const urls = [
    ...(packageFile?.registryUrls ?? []),
    ...(packageFile?.additionalRegistryUrls ?? []),
  ];

  const uniqueHosts = new Set<URL>(
    urls.map(cleanUrl).filter(isNotNullOrUndefined),
  );

  let allCreds: ExtraEnv<string> = {};
  for (const [index, host] of [...uniqueHosts].entries()) {
    const hostCreds = getRegistryCredEnvVars(host, index);
    allCreds = {
      ...allCreds,
      ...hostCreds,
    };
  }

  return allCreds;
}
