import gunzip from 'gunzip-maybe';
import tar from 'tar-stream';
import * as git from '../../../util/git';
import type { CommitFilesConfig, LongCommitSha } from '../../../util/git/types';
import { DefaultGitScm } from '../default-scm';
import { githubApi } from './common';
import { commitFiles, getScmConfig } from './';

function stripRootDir(name: string): string {
  const index = name.indexOf('/');
  if (index !== -1) {
    return name.slice(index + 1);
  }
  return name;
}

export class GithubScm extends DefaultGitScm {
  override commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    return commitConfig.platformCommit
      ? commitFiles(commitConfig)
      : git.commitFiles(commitConfig);
  }

  override async getFileList(): Promise<string[]> {
    const { repository, defaultBranch, endpoint } = getScmConfig();
    const branch = git.getCurrentBranch() ?? defaultBranch;
    const tarballUrl = `${endpoint}repos/${repository}/tarball/${branch}`;

    const extractGzip = gunzip();
    const extractTar = tar.extract({
      filenameEncoding: 'utf-8',
      allowUnknownFormat: true,
    });
    const stream = githubApi
      .stream(tarballUrl)
      .pipe(extractGzip)
      .pipe(extractTar);

    const files: string[] = [];
    for await (const entry of stream) {
      const { type } = entry.header;
      if (type !== 'file') {
        continue;
      }
      const name = stripRootDir(entry.header.name);
      files.push(name);
    }

    // return files;
    const res = await git.getFileList();
    return res;
  }
}
