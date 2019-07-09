import URL from 'url';
import is from '@sindresorhus/is';

import api from './gl-got-wrapper';
import * as hostRules from '../../util/host-rules';
import GitStorage from '../git/storage';
import { PlatformConfig } from '../common';

let config: {
  storage: GitStorage;
  repository: string;
  localDir: string;
  defaultBranch: string;
  baseBranch: string;
  email: string;
  prList: any[];
  issueList: any[];
} = {} as any;

const defaults = {
  hostType: 'gitlab',
  endpoint: 'https://gitlab.com/api/v4/',
};

export async function initPlatform({
  endpoint,
  token,
}: {
  endpoint: string;
  token: string;
}) {
  logger.debug(`initPlatform('${endpoint}, '${token})`);
  logger.warn('Unimplemented in Gitea: initPlatform');
  const res = {} as any;
  return res;
}

// Get all repositories that the user has access to
export async function getRepos() {
  logger.info('Autodiscovering GitLab repositories');
  logger.warn('Unimplemented in Gitea: getRepos');
  return {};
}
