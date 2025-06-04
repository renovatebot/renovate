import { quote } from 'shlex';
import upath from 'upath';

import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import type { ExtraEnv } from '../../../util/exec/types';
import { privateCacheDir } from '../../../util/fs';
import { addSecretForSanitizing } from '../../../util/sanitize';
import { fromBase64 } from '../../../util/string';
import { ecrRegex, getECRAuthToken } from '../../datasource/docker/ecr';
import type { RepositoryRule } from './types';

export async function generateLoginCmd(
  repositoryRule: RepositoryRule,
): Promise<string | null> {
  logger.trace({ repositoryRule }, 'Generating Helm registry login command');
  const { hostRule, repository } = repositoryRule;
  const { username, password } = hostRule;
  const loginCMD = 'helm registry login';
  if (username !== 'AWS' && ecrRegex.test(repository)) {
    logger.trace({ repository }, `Using ecr auth for Helm registry`);
    const [, region] = coerceArray(ecrRegex.exec(repository));
    const auth = await getECRAuthToken(region, hostRule);
    if (!auth) {
      return null;
    }
    const [username, password] = fromBase64(auth).split(':');
    if (!username || !password) {
      return null;
    }
    addSecretForSanitizing(username);
    addSecretForSanitizing(password);
    return `${loginCMD} --username ${quote(username)} --password ${quote(
      password,
    )} ${quote(repository)}`;
  }
  if (username && password) {
    logger.trace({ repository }, `Using basic auth for Helm registry`);
    // Split off any path as it's not valid for the helm registry login command
    const hostPart = repository.split('/')[0];
    const cmd = `${loginCMD} --username ${quote(username)} --password ${quote(
      password,
    )} ${quote(hostPart)}`;
    logger.trace({ cmd }, 'Generated Helm registry login command');
    return cmd;
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
      'repositories.yaml',
    )}`,
    HELM_REPOSITORY_CACHE: `${upath.join(privateCacheDir(), 'repositories')}`,
  };
}
