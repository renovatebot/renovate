import is from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { ensureCacheDir, readLocalFile } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pip_requirements.updateArtifacts(${packageFileName})`);
  if (!is.nonEmptyArray(updatedDeps)) {
    logger.debug('No updated pip_requirements deps - returning null');
    return null;
  }
  try {
    const cmd: string[] = [];
    const rewrittenContent = newPackageFileContent.replace(regEx(/\\\n/g), '');
    const lines = rewrittenContent
      .split(newlineRegex)
      .map((line) => line.trim());
    for (const dep of updatedDeps) {
      const hashLine = lines.find(
        (line) =>
          // TODO: types (#7154)
          line.startsWith(`${dep.depName!}==`) && line.includes('--hash=')
      );
      if (hashLine) {
        const depConstraint = hashLine.split(' ')[0];
        cmd.push(`hashin ${depConstraint} -r ${packageFileName}`);
      }
    }
    if (!cmd.length) {
      logger.debug('No hashin commands to run - returning');
      return null;
    }
    const execOptions: ExecOptions = {
      cwdFile: '.',
      docker: {
        image: 'sidecar',
      },
      preCommands: ['pip install --user hashin'],
      toolConstraints: [
        { toolName: 'python', constraint: config.constraints?.python },
      ],
      extraEnv: {
        PIP_CACHE_DIR: await ensureCacheDir('pip'),
      },
    };
    await exec(cmd, execOptions);
    const newContent = await readLocalFile(packageFileName, 'utf8');
    if (newContent === newPackageFileContent) {
      logger.debug(`${packageFileName} is unchanged`);
      return null;
    }
    logger.debug(`Returning updated ${packageFileName}`);
    return [
      {
        file: {
          type: 'addition',
          path: packageFileName,
          contents: newContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, `Failed to update ${packageFileName} file`);
    return [
      {
        artifactError: {
          lockFile: packageFileName,
          stderr: `${String(err.stdout)}\n${String(err.stderr)}`,
        },
      },
    ];
  }
}
