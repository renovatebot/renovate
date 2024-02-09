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
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import * as pipRequirements from '../pip_requirements';
import type {
  PackageFileContent,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../types';
import {
  constraintLineRegex,
  deprecatedAllowedPipArguments,
  getExecOptions,
} from './common';
import type { GetRegistryUrlVarsResult } from './types';

function buildRegistryUrl(url: string): URL {
  const hostRule = hostRules.find({ url });
  const ret = new URL(url);
  if (!ret.username) {
    ret.username = hostRule.username ?? '';
    ret.password = hostRule.password ?? '';
  }
  return ret;
}

function getRegistryUrlVarFromUrls(
  varName: keyof GetRegistryUrlVarsResult['environmentVars'],
  urls: URL[],
): GetRegistryUrlVarsResult {
  let haveCredentials = false;
  for (const url of urls) {
    if (url.username) {
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
    packageFile?.registryUrls?.map(buildRegistryUrl) ?? [],
  );
  const extraIndexUrls = getRegistryUrlVarFromUrls(
    'PIP_EXTRA_INDEX_URL',
    packageFile?.additionalRegistryUrls?.map(buildRegistryUrl) ?? [],
  );

  return {
    haveCredentials: indexUrl.haveCredentials || extraIndexUrls.haveCredentials,
    environmentVars: {
      ...indexUrl.environmentVars,
      ...extraIndexUrls.environmentVars,
    },
  };
}

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
  logger.debug(
    `pipCompile.updateArtifacts(${inputFileName}->${outputFileName})`,
  );
  const existingOutput = await readLocalFile(outputFileName, 'utf8');
  if (!existingOutput) {
    logger.debug('No pip-compile output file found');
    return null;
  }
  try {
    await writeLocalFile(inputFileName, newInputContent);
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
    const execOptions = await getExecOptions(config, inputFileName, registryUrlVars.environmentVars);
    logger.trace({ cmd }, 'pip-compile command');
    logger.trace({ env: execOptions.extraEnv }, 'pip-compile extra env vars');
    await exec(cmd, execOptions);
    const status = await getRepoStatus();
    if (!status?.modified.includes(outputFileName)) {
      return null;
    }
    logger.debug('Returning updated pip-compile result');
    return [
      {
        file: {
          type: 'addition',
          path: outputFileName,
          contents: await readLocalFile(outputFileName, 'utf8'),
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to pip-compile');
    return [
      {
        artifactError: {
          lockFile: outputFileName,
          stderr: err.message,
        },
      },
    ];
  }
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
