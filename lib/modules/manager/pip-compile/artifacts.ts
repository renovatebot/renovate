import is from '@sindresorhus/is';
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
import { regEx } from '../../../util/regex';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

function getPythonConstraint(
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

function getPipToolsConstraint(config: UpdateArtifactsConfig): string {
  const { constraints = {} } = config;
  const { pipTools } = constraints;

  if (is.string(pipTools)) {
    logger.debug('Using pipTools constraint from config');
    return pipTools;
  }

  return '';
}

const constraintLineRegex = regEx(
  /^(#.*?\r?\n)+# {4}pip-compile(?<arguments>.*?)\r?\n/,
);
const allowedPipArguments = [
  '--allow-unsafe',
  '--generate-hashes',
  '--no-emit-index-url',
  '--strip-extras',
];

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
    logger.trace({ cmd }, 'pip-compile command');
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
