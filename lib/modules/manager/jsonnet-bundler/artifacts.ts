import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { exec } from '../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { regEx } from '../../../util/regex';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../types';

function dependencyUrl(dep: PackageDependency): string {
  const url = dep.packageName!;
  if (dep.managerData?.subdir) {
    return url.concat('/', dep.managerData.subdir);
  }
  return url;
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, config } = updateArtifact;
  logger.trace({ packageFileName }, 'jsonnet-bundler.updateArtifacts()');

  const lockFileName = packageFileName.replace(regEx(/\.json$/), '.lock.json');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');

  if (!existingLockFileContent) {
    logger.debug('No jsonnetfile.lock.json found');
    return null;
  }

  const jsonnetBundlerToolConstraint: ToolConstraint = {
    toolName: 'jb',
    constraint: config.constraints?.jb,
  };

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    docker: {},
    toolConstraints: [jsonnetBundlerToolConstraint],
  };

  try {
    if (config.isLockFileMaintenance) {
      await exec('jb update', execOptions);
    } else {
      const dependencyUrls = updatedDeps.map(dependencyUrl);
      if (dependencyUrls.length > 0) {
        await exec(
          `jb update ${dependencyUrls.map(quote).join(' ')}`,
          execOptions,
        );
      }
    }

    const status = await getRepoStatus();

    if (status.isClean()) {
      return null;
    }

    const res: UpdateArtifactsResult[] = [];

    for (const f of coerceArray(status.modified)) {
      res.push({
        file: {
          type: 'addition',
          path: f,
          contents: await readLocalFile(f),
        },
      });
    }
    for (const f of coerceArray(status.not_added)) {
      res.push({
        file: {
          type: 'addition',
          path: f,
          contents: await readLocalFile(f),
        },
      });
    }
    for (const f of coerceArray(status.deleted)) {
      res.push({
        file: {
          type: 'deletion',
          path: f,
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
