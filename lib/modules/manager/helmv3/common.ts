import semver from 'semver';
import { quote } from 'shlex';
import upath from 'upath';

import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import type { ExtraEnv } from '../../../util/exec/types.ts';
import { privateCacheDir } from '../../../util/fs/index.ts';
import { addSecretForSanitizing } from '../../../util/sanitize.ts';
import { fromBase64 } from '../../../util/string.ts';
import { ecrRegex, getECRAuthToken } from '../../datasource/docker/ecr.ts';
import type { RepositoryRule } from './types.ts';

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

export function generateHelmEnvs(helmConstraint?: string): ExtraEnv {
  const envs: ExtraEnv = {};

  // Helm >= 3.8 ignores HELM_EXPERIMENTAL_OCI, so it's harmless to set it
  // when the constraint is unknown. Dropping it for an unconstrained helm
  // could break helm < 3.8 users, so only omit it once the constraint
  // proves helm >= 3.8.
  if (!helmConstraint || !semver.intersects(helmConstraint, '>=3.8.0')) {
    envs.HELM_EXPERIMENTAL_OCI = '1';
  }

  // set cache and config files to a path in privateCacheDir to prevent file and credential leakage
  envs.HELM_REGISTRY_CONFIG = `${upath.join(
    privateCacheDir(),
    'registry.json',
  )}`;
  envs.HELM_REPOSITORY_CONFIG = `${upath.join(
    privateCacheDir(),
    'repositories.yaml',
  )}`;
  envs.HELM_REPOSITORY_CACHE = `${upath.join(
    privateCacheDir(),
    'repositories',
  )}`;

  return envs;
}
