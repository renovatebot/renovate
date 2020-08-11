import is from '@sindresorhus/is';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import { readLocalFile } from '../../util/fs';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';

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
    const rewrittenContent = newPackageFileContent.replace(/\\\n/g, '');
    const lines = rewrittenContent.split('\n').map((line) => line.trim());
    for (const dep of updatedDeps) {
      const hashLine = lines.find(
        (line) => line.startsWith(`${dep}==`) && line.includes('--hash=')
      );
      if (hashLine) {
        const depConstraint = hashLine.split(' ')[0];
        cmd.push(`hashin ${depConstraint} -r ${packageFileName}`);
      }
    }
    const execOptions: ExecOptions = {
      cwdFile: '.',
      docker: {
        image: 'renovate/python',
        tagScheme: 'pip_requirements',
        preCommands: ['pip install hashin'],
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
          name: packageFileName,
          contents: newContent,
        },
      },
    ];
  } catch (err) {
    logger.debug({ err }, `Failed to update ${packageFileName} file`);
    return [
      {
        artifactError: {
          lockFile: packageFileName,
          stderr: `${err.stdout}\n${err.stderr}`,
        },
      },
    ];
  }
}
