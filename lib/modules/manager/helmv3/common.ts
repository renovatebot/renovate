import { quote } from 'shlex';
import upath from 'upath';

import type { ExtraEnv } from '../../../util/exec/types';
import { privateCacheDir } from '../../../util/fs';
import type { RepositoryRule } from './types';

export function generateLoginCmd(
  repositoryRule: RepositoryRule,
  loginCMD: string
): string | null {
  const { username, password } = repositoryRule.hostRule;
  if (username && password) {
    return `${loginCMD} --username ${quote(username)} --password ${quote(
      password
    )} ${repositoryRule.repository}`;
  }
  return null;
}

export function generateHelmEnvs(): ExtraEnv {
  return {
    HELM_EXPERIMENTAL_OCI: '1',
    // set cache and config files to a path in privateCacheDir to prevent file and credential leakage
    HELM_REGISTRY_CONFIG: `${upath.join(privateCacheDir(), 'registry.json')}`,
    HELM_REPOSITORY_CONFIG: `${upath.join(
      privateCacheDir(),
      'repositories.yaml'
    )}`,
    HELM_REPOSITORY_CACHE: `${upath.join(privateCacheDir(), 'repositories')}`,
  };
}
