import * as git from '../../../util/git';
import type { CommitFilesConfig } from '../../../util/git/types';
import type { PlatformScm } from '../types';
import { commitFiles } from './index';

const githubScm: Partial<PlatformScm> = {
  commitAndPush: (config: CommitFilesConfig) =>
    config.platformCommit ? commitFiles(config) : git.commitFiles(config),
};

export default githubScm;
