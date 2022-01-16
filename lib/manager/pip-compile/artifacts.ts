import is from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { exec } from '../../util/exec';
import type { ExecOptions } from '../../util/exec/types';
import { deleteLocalFile, readLocalFile, writeLocalFile } from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import { regEx } from '../../util/regex';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

function getPythonConstraint(
  config: UpdateArtifactsConfig
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

export async function updateArtifacts({
  packageFileName: inputFileName,
  newPackageFileContent: newInputContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const outputFileName = inputFileName.replace(regEx(/(\.in)?$/), '.txt');
  logger.debug(
    `pipCompile.updateArtifacts(${inputFileName}->${outputFileName})`
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
    const cmd = `pip-compile ${quote(upath.parse(inputFileName).base)}`;
    const tagConstraint = getPythonConstraint(config);
    const pipToolsConstraint = getPipToolsConstraint(config);
    const execOptions: ExecOptions = {
      cwdFile: inputFileName,
      docker: {
        image: 'python',
        tagConstraint,
        tagScheme: 'pep440',
      },
      preCommands: [
        `pip install --user ${quote(`pip-tools${pipToolsConstraint}`)}`,
      ],
    };
    logger.debug({ cmd }, 'pip-compile command');
    await exec(cmd, execOptions);
    const status = await getRepoStatus();
    if (!status?.modified.includes(outputFileName)) {
      return null;
    }
    logger.debug('Returning updated pip-compile result');
    return [
      {
        file: {
          name: outputFileName,
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
