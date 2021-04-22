import url from 'url';
import is from '@sindresorhus/is';
import ini from 'ini';
import registryAuthToken from 'registry-auth-token';
import getRegistryUrl from 'registry-auth-token/registry-url';
import { getAdminConfig } from '../../config/admin';
import { logger } from '../../logger';
import type { OutgoingHttpHeaders } from '../../util/http/types';
import { maskToken } from '../../util/mask';
import { add } from '../../util/sanitize';

let npmrc: Record<string, any> = {};
let npmrcRaw = '';

export type Npmrc = Record<string, any>;

export function getNpmrc(): Npmrc | null {
  return npmrc;
}

function envReplace(value: any, env = process.env): any {
  // istanbul ignore if
  if (!is.string(value)) {
    return value;
  }

  const ENV_EXPR = /(\\*)\$\{([^}]+)\}/g;

  return value.replace(ENV_EXPR, (match, esc, envVarName) => {
    if (env[envVarName] === undefined) {
      logger.warn('Failed to replace env in config: ' + match);
      throw new Error('env-replace');
    }
    return env[envVarName];
  });
}

const envRe = /(\\*)\$\{([^}]+)\}/;
// TODO: better add to host rules
function sanitize(key: string, val: string): void {
  if (!val || envRe.test(val)) {
    return;
  }
  if (key.endsWith('_authToken') || key.endsWith('_auth')) {
    add(val);
  } else if (key.endsWith(':_password')) {
    add(val);
    const password = Buffer.from(val, 'base64').toString();
    add(password);
    const username: string = npmrc[key.replace(':_password', ':username')];
    add(Buffer.from(`${username}:${password}`).toString('base64'));
  }
}

export function setNpmrc(input?: string): void {
  if (input) {
    if (input === npmrcRaw) {
      return;
    }
    const existingNpmrc = npmrc;
    npmrcRaw = input;
    logger.debug('Setting npmrc');
    npmrc = ini.parse(input.replace(/\\n/g, '\n'));
    const { exposeAllEnv } = getAdminConfig();
    for (const [key, val] of Object.entries(npmrc)) {
      if (!exposeAllEnv) {
        sanitize(key, val);
      }
      if (
        !exposeAllEnv &&
        key.endsWith('registry') &&
        val &&
        val.includes('localhost')
      ) {
        logger.debug(
          { key, val },
          'Detected localhost registry - rejecting npmrc file'
        );
        npmrc = existingNpmrc;
        return;
      }
    }
    if (!exposeAllEnv) {
      return;
    }
    for (const key of Object.keys(npmrc)) {
      npmrc[key] = envReplace(npmrc[key]);
      sanitize(key, npmrc[key]);
    }
  } else if (npmrc) {
    logger.debug('Resetting npmrc');
    npmrc = {};
    npmrcRaw = '';
  }
}

export interface PackageResolution {
  headers: OutgoingHttpHeaders;
  packageUrl: string;
  registryUrl: string;
}

export function resolvePackage(packageName: string): PackageResolution {
  const scope = packageName.split('/')[0];
  let registryUrl: string;
  try {
    registryUrl = getRegistryUrl(scope, getNpmrc());
  } catch (err) {
    registryUrl = 'https://registry.npmjs.org/';
  }
  const packageUrl = url.resolve(
    registryUrl,
    encodeURIComponent(packageName).replace(/^%40/, '@')
  );
  const headers: OutgoingHttpHeaders = {};
  let authInfo = registryAuthToken(registryUrl, { npmrc, recursive: true });
  if (
    !authInfo &&
    npmrc &&
    npmrc._authToken &&
    registryUrl.replace(/\/?$/, '/') === npmrc.registry?.replace(/\/?$/, '/')
  ) {
    authInfo = { type: 'Bearer', token: npmrc._authToken };
  }

  if (authInfo?.type && authInfo.token) {
    headers.authorization = `${authInfo.type} ${authInfo.token}`;
    logger.trace(
      { token: maskToken(authInfo.token), npmName: packageName },
      'Using auth (via npmrc) for npm lookup'
    );
  }
  return { headers, packageUrl, registryUrl };
}
