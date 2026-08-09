import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import { readLocalFile, statLocalFile } from '../../../util/fs/index.ts';
import { getGitEnvironmentVariables } from '../../../util/git/auth.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import type { FileAddition } from '../../../util/git/types.ts';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types.ts';
import {
  getCopierVersionConstraint,
  getPythonVersionConstraint,
} from './utils.ts';

const DEFAULT_COMMAND_OPTIONS = ['--skip-answered', '--defaults'];
const ownerExecutePermission = 0o100;

async function readFileAddition(path: string): Promise<FileAddition> {
  const file: FileAddition = {
    type: 'addition',
    path,
    contents: await readLocalFile(path),
  };
  const stats = await statLocalFile(path);
  if (stats?.isFile() && (stats.mode & ownerExecutePermission) !== 0) {
    file.isExecutable = true;
  }
  return file;
}

function buildCommand(
  config: UpdateArtifactsConfig,
  packageFileName: string,
  newValue: string,
): string {
  const command = ['copier', 'update', ...DEFAULT_COMMAND_OPTIONS];
  if (GlobalConfig.get('allowScripts') && !config.ignoreScripts) {
    command.push('--trust');
  }
  command.push(
    '--answers-file',
    quote(upath.basename(packageFileName)),
    '--vcs-ref',
    quote(newValue),
  );
  return command.join(' ');
}

function artifactError(
  packageFileName: string,
  message: string,
): UpdateArtifactsResult[] {
  return [
    {
      artifactError: {
        fileName: packageFileName,
        stderr: message,
      },
    },
  ];
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (updatedDeps?.length !== 1) {
    // Each answers file (~ packageFileName) has exactly one dependency to update.
    return artifactError(
      packageFileName,
      `Unexpected number of dependencies: ${updatedDeps?.length} (should be 1)`,
    );
  }

  const newValue = updatedDeps[0]?.newValue;
  if (!newValue) {
    return artifactError(
      packageFileName,
      'Missing copier template version to update to',
    );
  }

  const command = buildCommand(config, packageFileName, newValue);
  const gitEnv = getGitEnvironmentVariables(['git-tags']);
  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    docker: {},
    extraEnv: gitEnv,
    toolConstraints: [
      {
        toolName: 'python',
        constraint: getPythonVersionConstraint(config),
      },
      {
        toolName: 'copier',
        constraint: getCopierVersionConstraint(config),
      },
    ],
  };
  try {
    await exec(command, execOptions);
  } catch (err) {
    logger.debug({ err }, `Failed to update copier template: ${err.message}`);
    return artifactError(packageFileName, err.message);
  }

  const status = await getRepoStatus();
  // If the answers file didn't change, Copier did not update anything.
  if (!status.modified.includes(packageFileName)) {
    return null;
  }

  if (status.conflicted.length > 0) {
    // Sometimes, Copier erroneously reports conflicts.
    const msg = `Updating the Copier template yielded ${status.conflicted.length} merge conflicts. Please check the proposed changes carefully! Conflicting files:\n  * ${status.conflicted.join('\n  * ')}`;
    logger.debug({ packageFileName, depName: updatedDeps[0]?.depName }, msg);
  }

  const res: UpdateArtifactsResult[] = [];

  for (const f of [
    ...status.modified,
    ...status.not_added,
    ...status.conflicted,
  ]) {
    const fileRes: UpdateArtifactsResult = {
      file: await readFileAddition(f),
    };
    if (status.conflicted.includes(f)) {
      // Make the reviewer aware of the conflicts.
      // This will be posted in a comment.
      fileRes.notice = {
        file: f,
        message:
          'This file had merge conflicts. Please check the proposed changes carefully!',
      };
    }
    res.push(fileRes);
  }
  for (const f of status.deleted) {
    res.push({
      file: {
        type: 'deletion',
        path: f,
      },
    });
  }
  // `git status` might detect a rename, which is then not contained
  // in not_added/deleted. Ensure we respect renames as well if they happen.
  for (const f of status.renamed) {
    res.push({
      file: {
        type: 'deletion',
        path: f.from,
      },
    });
    res.push({
      file: await readFileAddition(f.to),
    });
  }
  return res;
}
