import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import { readLocalFile } from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import { regEx } from '../../util/regex';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../types';

function dependencyUrl(dep: PackageDependency): string {
  const url = dep.lookupName;
  if (dep.managerData.subdir) {
    return url.concat('/', dep.managerData.subdir);
  }
  return url;
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.trace(`jsonnetfile.updateArtifacts(${packageFileName})`);
  logger.trace({ newPackageFileContent });

  const lockFileName = packageFileName.replace(regEx(/\.json$/), '.lock.json');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');

  if (!existingLockFileContent) {
    logger.debug('No jsonnetfile.lock.json found');
    return null;
  }

  try {
    let cmd: string;
    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
    };

    if (config.isLockFileMaintenance) {
      cmd = 'jb update';
    } else {
      cmd = `jb update ${updatedDeps.map(dependencyUrl).map(quote).join(' ')}`;
    }

    await exec(cmd, execOptions);

    const status = await getRepoStatus();

    if (status.isClean()) {
      return null;
    }

    const res: UpdateArtifactsResult[] = [];

    for (const f of status.modified.concat(status.not_added)) {
      res.push({
        file: {
          name: f,
          contents: await readLocalFile(f),
        },
      });
    }
    for (const f of status.deleted) {
      res.push({
        file: {
          name: '|delete|',
          contents: f,
        },
      });
    }

    return res;
  } catch (err) /* istanbul ignore next */ {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.stderr,
        },
      },
    ];
  }
}
