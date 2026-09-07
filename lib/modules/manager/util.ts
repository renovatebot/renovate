import { logger } from '../../logger/index.ts';
import { detectPlatform } from '../../util/common.ts';
import type { ExecError } from '../../util/exec/exec-error.ts';
import {
  deleteLocalFile,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs/index.ts';
import type { FileChange } from '../../util/git/types.ts';
import { parseGitUrl } from '../../util/git/url.ts';
import { GitRefsDatasource } from '../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../datasource/gitlab-tags/index.ts';
import type {
  PackageDependency,
  UpdateArtifactsResult,
  UpdateLockFileConfig,
} from './types.ts';

export function applyGitSource(
  dep: PackageDependency,
  git: string,
  rev: string | undefined,
  tag: string | undefined,
  branch: string | undefined,
): void {
  if (tag) {
    const platform = detectPlatform(git);
    if (platform === 'github' || platform === 'gitlab') {
      dep.datasource =
        platform === 'github'
          ? GithubTagsDatasource.id
          : GitlabTagsDatasource.id;
      const { host, full_name } = parseGitUrl(git);

      // Always use HTTPS for GitHub/GitLab API endpoints, even if the git URL protocol is SSH.
      dep.registryUrls = [`https://${host}`];
      dep.packageName = full_name;
    } else {
      dep.datasource = GitTagsDatasource.id;
      dep.packageName = git;
    }
    dep.currentValue = tag;
    dep.skipReason = undefined;
  } else if (rev) {
    dep.datasource = GitRefsDatasource.id;
    dep.packageName = git;
    dep.currentDigest = rev;
    dep.replaceString = rev;
    dep.skipReason = undefined;
  } else {
    dep.datasource = GitRefsDatasource.id;
    dep.packageName = git;
    dep.currentValue = branch;
    dep.skipReason = branch ? 'git-dependency' : 'unspecified-version';
  }
}

/**
 * Given an {@link ExecError}, retrieve the message which will be used for an {@link ArtifactError}.
 *
 * An `ExecError` always carries a `stderr` property, so nullish coalescing would keep an empty string and render an artifact error with no message at all.
 *
 */
export function artifactErrorMessageFromExecError(
  err: Partial<ExecError>,
  message: string,
): string {
  if (err.stderr?.trim()) {
    return err.stderr;
  }

  if (err.stdout?.trim()) {
    return err.stdout;
  }

  return message;
}

/**
 * Wraps {@link FileChange}s, e.g. the result of `collectFileChanges()`, into the
 * result shape returned by `updateArtifacts()`.
 */
export function fileChangesToArtifactResults(
  changes: FileChange[],
): UpdateArtifactsResult[] {
  return changes.map((file) => ({ file }));
}

/**
 * The result which reports `path` as created or updated.
 */
export function fileAddition(
  path: string,
  contents: string | Buffer | null,
): UpdateArtifactsResult {
  return { file: { type: 'addition', path, contents } };
}

/**
 * The result which reports a failed artifact update to the user.
 */
export function artifactError(
  fileName: string | undefined,
  stderr: string,
): UpdateArtifactsResult {
  return { artifactError: { fileName, stderr } };
}

/**
 * The result for an artifact update which threw, using the most informative
 * output the error carries. Callers are expected to have rethrown
 * `TEMPORARY_ERROR` and logged the error before calling this.
 */
export function artifactErrorResult(
  fileName: string | undefined,
  err: Error & Partial<ExecError>,
): UpdateArtifactsResult[] {
  return [
    artifactError(
      fileName,
      artifactErrorMessageFromExecError(err, err.message),
    ),
  ];
}

/**
 * The skeleton shared by the managers which regenerate a single lock file:
 * rewrite the package file, optionally drop the lock file, run the package
 * manager and return the lock file when its content changed.
 *
 * Errors from `run()` are not handled here - callers keep their own logging and
 * pass the error to {@link artifactErrorResult}.
 */
export async function updateLockFile({
  lockFileName,
  existingLockFileContent,
  packageFile,
  deleteLockFile,
  run,
}: UpdateLockFileConfig): Promise<UpdateArtifactsResult[] | null> {
  if (packageFile) {
    await writeLocalFile(packageFile.path, packageFile.contents);
  }

  if (deleteLockFile) {
    await deleteLocalFile(lockFileName);
  }

  await run();

  const newLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!newLockFileContent) {
    logger.debug(`No ${lockFileName} found`);
    return null;
  }

  if (existingLockFileContent === newLockFileContent) {
    logger.debug(`${lockFileName} is unchanged`);
    return null;
  }

  return [fileAddition(lockFileName, newLockFileContent)];
}
