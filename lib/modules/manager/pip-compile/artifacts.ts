import { quote, split } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  deleteLocalFile,
  ensureCacheDir,
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
  allowedPipArguments,
  constraintLineRegex,
  getPipToolsConstraint,
  getPythonConstraint,
} from './common';

function buildRegistryUrl(url: string): string {
  const hostRule = hostRules.find({ url });
  const ret = new URL(url);
  if (!ret.username) {
    ret.username = hostRule.username ?? '';
    ret.password = hostRule.password ?? '';
  }
  return ret.href;
}

interface GetRegistryUrlFlagsResult {
  PIP_INDEX_URL?: string;
  PIP_EXTRA_INDEX_URL?: string;
}

export function getRegistryUrlVarsFromPackageFile(
  packageFile: PackageFileContent | null,
): GetRegistryUrlFlagsResult {
  const ret: GetRegistryUrlFlagsResult = {};
  // There should only ever be element in registryUrls, since pip_requirements gets them from --index-url
  // flags in the input file, and that only makes sense once
  const registryUrls = packageFile?.registryUrls
    ?.map(buildRegistryUrl)
    .join(' ');
  if (registryUrls) {
    ret.PIP_INDEX_URL = registryUrls;
  }

  const additionalRegistryUrls = packageFile?.additionalRegistryUrls
    ?.map(buildRegistryUrl)
    .join(' ');
  if (additionalRegistryUrls) {
    ret.PIP_EXTRA_INDEX_URL = additionalRegistryUrls;
  }
  return ret;
}

export function constructPipCompileCmd(
  content: string,
  inputFileName: string,
  outputFileName: string,
): string {
  const headers = constraintLineRegex.exec(content);
  const args = ['pip-compile'];
  if (headers?.groups) {
    logger.debug(`Found pip-compile header: ${headers[0]}`);
    for (const argument of split(headers.groups.arguments)) {
      if (allowedPipArguments.includes(argument)) {
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
    const cmd = constructPipCompileCmd(
      existingOutput,
      inputFileName,
      outputFileName,
    );
    const constraint = getPythonConstraint(config);
    const pipToolsConstraint = getPipToolsConstraint(config);
    const packageFile = pipRequirements.extractPackageFile(newInputContent);
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
        // Using environment variables for these since pip-compile's --no-emit-index-url flag doesn't prevent
        // index URLs passed as command line parameters from being included in the header comment
        ...getRegistryUrlVarsFromPackageFile(packageFile),
      },
    };
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
